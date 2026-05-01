import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DockerService } from './dockerService';
import { PortManager } from './portManager';

const execAsync = promisify(exec);

export interface ExportResult {
    success: boolean;
    archivePath?: string;
    wasRunning?: boolean;
    message: string;
    details: string[];
}

export interface ImportResult {
    success: boolean;
    instanceName?: string;
    message: string;
    details: string[];
}

/**
 * Service for exporting and importing complete REDAXO instances.
 *
 * Export bundle (.tar.gz) contains:
 *   manifest.json          – metadata (original name, PHP/MariaDB version, ports, …)
 *   docker-compose.yml     – container configuration
 *   .env                   – environment variables
 *   custom-setup.sh        – optional setup script
 *   ssl/                   – SSL certificates (if present)
 *   mysql-init/            – DB init scripts (if present)
 *   db-dump.sql            – full mysqldump of all databases
 *   redaxo-files.tar.gz    – web-root / REDAXO files (data/ or project/)
 *
 * Import:
 *   - Extracts the archive into a new instance directory
 *   - Finds fresh, conflict-free ports
 *   - Patches .env + docker-compose.yml with the new ports
 *   - Restores the DB dump after containers are running
 */
export class InstanceTransferService {

    private static dockerService: DockerService;
    private static outputChannel: vscode.OutputChannel;

    static initialize(dockerService: DockerService, outputChannel: vscode.OutputChannel): void {
        this.dockerService = dockerService;
        this.outputChannel = outputChannel;
    }

    private static log(msg: string): void {
        console.log(msg);
        this.outputChannel?.appendLine(msg);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Export
    // ────────────────────────────────────────────────────────────────────────────

    static async exportInstance(
        instanceName: string,
        targetDir: string,
        progress?: vscode.Progress<{ increment?: number; message?: string }>
    ): Promise<ExportResult> {
        const details: string[] = [];
        const report = (pct: number, msg: string) => {
            this.log(msg);
            details.push(msg);
            progress?.report({ increment: pct, message: msg });
        };

        let wasRunning = false;

        try {
            const instancesDir = await this.dockerService.getInstancesDirectory();
            const instancePath  = path.join(instancesDir, instanceName);
            const instance      = await this.dockerService.getInstance(instanceName);

            if (!instance) {
                return { success: false, message: `Instance "${instanceName}" not found.`, details };
            }

            // ── 0. DB dump first (while instance is still running) ───────────
            wasRunning = instance.running === true;

            // Working directory for staging
            const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `redaxo-export-${instanceName}-`));
            report(5, `Staging export in ${tmpDir} …`);

            // ── 1. Copy config files ─────────────────────────────────────────
            report(10, 'Copying configuration files …');
            const filesToCopy = ['docker-compose.yml', '.env', 'custom-setup.sh', 'Dockerfile'];
            for (const f of filesToCopy) {
                const src = path.join(instancePath, f);
                try {
                    await fs.copyFile(src, path.join(tmpDir, f));
                } catch { /* file doesn't exist – skip */ }
            }

            // Copy directories
            const dirsToCopy = ['ssl', 'mysql-init', 'apache-ssl.conf'];
            for (const d of dirsToCopy) {
                const src = path.join(instancePath, d);
                try {
                    await execAsync(`cp -r "${src}" "${tmpDir}/${d}"`);
                } catch { /* directory doesn't exist – skip */ }
            }

            // ── 2. Write manifest ────────────────────────────────────────────
            report(15, 'Writing manifest …');
            const manifest = {
                version: 1,
                exportedAt: new Date().toISOString(),
                originalName: instanceName,
                phpVersion: instance.phpVersion,
                mariadbVersion: instance.mariadbVersion,
                instanceType: instance.instanceType ?? 'standard',
                ports: {
                    http: instance.httpPort,
                    https: instance.httpsPort,
                },
                sslEnabled: instance.httpsPort !== undefined,
            };
            await fs.writeFile(
                path.join(tmpDir, 'manifest.json'),
                JSON.stringify(manifest, null, 2),
                'utf8'
            );

            // ── 3. Database dump (before stopping – DB container must be live) ─
            report(20, 'Dumping database …');
            let dbDumpOk = false;
            if (wasRunning) {
                try {
                    const dbContainerName = await this.dockerService.getDbContainerName(instanceName);
                    if (dbContainerName) {
                        const envPath = path.join(instancePath, '.env');
                        const envContent = await fs.readFile(envPath, 'utf8');
                        const env: Record<string, string> = {};
                        envContent.split('\n').forEach(line => {
                            const eq = line.indexOf('=');
                            if (eq > 0) { env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim(); }
                        });

                        const rootPwd = env['DB_ROOT_PASSWORD'] || env['MYSQL_ROOT_PASSWORD'] || 'root';
                        const dumpCmd = `docker exec "${dbContainerName}" sh -c "mysqldump -u root -p'${rootPwd}' --all-databases --single-transaction --routines --triggers 2>/dev/null || mariadb-dump -u root -p'${rootPwd}' --all-databases --single-transaction --routines --triggers 2>/dev/null"`;
                        const { stdout: dumpSql } = await execAsync(dumpCmd);
                        await fs.writeFile(path.join(tmpDir, 'db-dump.sql'), dumpSql, 'utf8');
                        details.push(`  ✅ DB dump created (${Math.round(dumpSql.length / 1024)} KB)`);
                        dbDumpOk = true;
                    } else {
                        details.push('  ⚠️  DB container not found – skipping DB dump');
                    }
                } catch (err: any) {
                    details.push(`  ⚠️  DB dump failed: ${err.message} – continuing without DB dump`);
                }
            } else {
                details.push('  ℹ️  Instance was already stopped – skipping DB dump (start instance and re-export for a full backup)');
            }

            // ── 4. Stop instance for consistent file snapshot ────────────────
            if (wasRunning) {
                report(35, `Stopping instance "${instanceName}" for consistent file snapshot …`);
                await this.dockerService.stopInstance(instanceName);
                details.push('  ✅ Instance stopped');
            }

            // ── 5. REDAXO / web files ────────────────────────────────────────
            report(40, 'Archiving web files …');
            const dataDir     = path.join(instancePath, 'data');
            const projectDir  = path.join(instancePath, 'project');
            let webSrcDir: string | null = null;
            const webTarName = 'redaxo-files.tar.gz';

            if (fsSync.existsSync(projectDir)) {
                webSrcDir = projectDir;
            } else if (fsSync.existsSync(dataDir)) {
                webSrcDir = dataDir;
            }

            if (webSrcDir) {
                const parentDir = path.dirname(webSrcDir);
                const baseName  = path.basename(webSrcDir);
                await execAsync(
                    `tar -czf "${path.join(tmpDir, webTarName)}" -C "${parentDir}" "${baseName}"`
                );
                details.push(`  ✅ Web files archived (${baseName}/)`);
            } else {
                details.push('  ℹ️  No data/ or project/ directory found – skipping web files');
            }

            // ── 5. Pack everything into final archive ────────────────────────
            report(70, 'Creating final archive …');
            const timestamp   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const archiveName = `${instanceName}-export-${timestamp}.tar.gz`;
            const archivePath = path.join(targetDir, archiveName);

            await execAsync(`tar -czf "${archivePath}" -C "${tmpDir}" .`);

            // ── 6. Cleanup ───────────────────────────────────────────────────
            report(90, 'Cleaning up …');
            await fs.rm(tmpDir, { recursive: true, force: true });

            // ── 7. Restart instance if it was running before ─────────────────
            if (wasRunning) {
                report(95, `Restarting instance "${instanceName}" …`);
                try {
                    await this.dockerService.startInstance(instanceName);
                    details.push('  ✅ Instance restarted');
                } catch (err: any) {
                    details.push(`  ⚠️  Could not restart instance: ${err.message}`);
                }
            }

            const stat   = await fs.stat(archivePath);
            const sizeMb = (stat.size / 1024 / 1024).toFixed(1);

            report(100, `Export complete! Archive: ${archiveName} (${sizeMb} MB)`);
            if (!dbDumpOk) {
                details.push('\n⚠️  Note: Database was not included. The instance was stopped during export – start it and re-export, or import the DB manually via Adminer.');
            }

            return {
                success: true,
                archivePath,
                wasRunning,
                message: `Instance "${instanceName}" exported to ${archiveName} (${sizeMb} MB)${wasRunning ? ' – instance restarted' : ''}`,
                details,
            };

        } catch (err: any) {
            // Try to restart instance even if export failed
            if (wasRunning) {
                try {
                    await this.dockerService.startInstance(instanceName);
                    details.push('  ↩️  Instance restarted after failed export');
                } catch { /* ignore */ }
            }
            return { success: false, message: `Export failed: ${err.message}`, details };
        }
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Import
    // ────────────────────────────────────────────────────────────────────────────

    static async importInstance(
        archivePath: string,
        newInstanceName: string,
        progress?: vscode.Progress<{ increment?: number; message?: string }>
    ): Promise<ImportResult> {
        const details: string[] = [];
        const report = (pct: number, msg: string) => {
            this.log(msg);
            details.push(msg);
            progress?.report({ increment: pct, message: msg });
        };

        let tmpDir: string | null = null;

        try {
            // ── 1. Validate input ────────────────────────────────────────────
            if (!/^[a-z0-9][a-z0-9-_]*$/.test(newInstanceName)) {
                return {
                    success: false,
                    message: 'Invalid instance name. Use only lowercase letters, numbers, hyphens and underscores.',
                    details,
                };
            }

            const instancesDir  = await this.dockerService.getInstancesDirectory();
            const targetPath    = path.join(instancesDir, newInstanceName);

            try {
                await fs.access(targetPath);
                return { success: false, message: `Instance "${newInstanceName}" already exists.`, details };
            } catch { /* good – doesn't exist yet */ }

            // ── 2. Extract archive ───────────────────────────────────────────
            report(5, 'Extracting archive …');
            tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `redaxo-import-${newInstanceName}-`));
            await execAsync(`tar -xzf "${archivePath}" -C "${tmpDir}"`);

            // ── 3. Read manifest ─────────────────────────────────────────────
            report(15, 'Reading manifest …');
            let manifest: any = {};
            try {
                const raw = await fs.readFile(path.join(tmpDir, 'manifest.json'), 'utf8');
                manifest = JSON.parse(raw);
                details.push(`  Exported from instance: ${manifest.originalName || 'unknown'}`);
                details.push(`  PHP: ${manifest.phpVersion || '?'}, MariaDB: ${manifest.mariadbVersion || '?'}`);
            } catch {
                details.push('  ⚠️  No manifest found – proceeding with defaults');
            }

            // ── 4. Create target directory ───────────────────────────────────
            report(20, `Creating instance directory: ${newInstanceName} …`);
            await fs.mkdir(targetPath, { recursive: true });

            // ── 5. Copy config files ─────────────────────────────────────────
            report(25, 'Copying configuration files …');
            const configFiles = ['docker-compose.yml', '.env', 'custom-setup.sh', 'Dockerfile', 'manifest.json'];
            for (const f of configFiles) {
                try {
                    await fs.copyFile(path.join(tmpDir, f), path.join(targetPath, f));
                } catch { /* skip */ }
            }

            const configDirs = ['ssl', 'mysql-init', 'apache-ssl.conf'];
            for (const d of configDirs) {
                const src = path.join(tmpDir, d);
                try {
                    await fs.access(src);
                    await execAsync(`cp -r "${src}" "${targetPath}/${d}"`);
                } catch { /* skip */ }
            }

            // ── 6. Assign fresh ports ────────────────────────────────────────
            report(35, 'Assigning fresh ports …');
            const [newHttpPort, newHttpsPort] = await PortManager.findAvailablePortRange();
            const newMysqlPort = await PortManager.findAvailablePort(3306);
            details.push(`  HTTP: ${newHttpPort}, HTTPS: ${newHttpsPort}, MySQL: ${newMysqlPort}`);

            // ── 7. Patch .env ────────────────────────────────────────────────
            report(40, 'Patching .env …');
            const envPath = path.join(targetPath, '.env');
            try {
                let envContent = await fs.readFile(envPath, 'utf8');
                const replaceEnvVar = (content: string, key: string, value: string): string =>
                    content.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);

                envContent = replaceEnvVar(envContent, 'HTTP_PORT',  String(newHttpPort));
                envContent = replaceEnvVar(envContent, 'HTTPS_PORT', String(newHttpsPort));
                envContent = replaceEnvVar(envContent, 'MYSQL_PORT', String(newMysqlPort));
                envContent = replaceEnvVar(envContent, 'PORT',       String(newHttpPort));
                // Update instance name references in env
                const originalName = manifest.originalName || '';
                if (originalName && originalName !== newInstanceName) {
                    envContent = envContent.replace(new RegExp(originalName, 'g'), newInstanceName);
                }
                await fs.writeFile(envPath, envContent, 'utf8');
            } catch {
                details.push('  ⚠️  Could not patch .env – you may need to update ports manually');
            }

            // ── 8. Patch docker-compose.yml ──────────────────────────────────
            report(45, 'Patching docker-compose.yml …');
            const composePath = path.join(targetPath, 'docker-compose.yml');
            try {
                let compose = await fs.readFile(composePath, 'utf8');
                const oldHttp  = manifest.ports?.http;
                const oldHttps = manifest.ports?.https;

                if (oldHttp)  { compose = compose.replace(new RegExp(`"${oldHttp}:(80)"`,  'g'), `"${newHttpPort}:80"`);  }
                if (oldHttps) { compose = compose.replace(new RegExp(`"${oldHttps}:(443)"`, 'g'), `"${newHttpsPort}:443"`); }
                // Patch MySQL port (any 4-5 digit port → 3306)
                compose = compose.replace(/"(\d{4,5}):3306"/g, `"${newMysqlPort}:3306"`);

                // Replace original instance name
                const originalName = manifest.originalName || '';
                if (originalName && originalName !== newInstanceName) {
                    compose = compose.replace(new RegExp(originalName, 'g'), newInstanceName);
                }
                await fs.writeFile(composePath, compose, 'utf8');
            } catch {
                details.push('  ⚠️  Could not patch docker-compose.yml – check ports manually');
            }

            // ── 9. Restore web files ─────────────────────────────────────────
            report(50, 'Restoring web files …');
            const webTar = path.join(tmpDir, 'redaxo-files.tar.gz');
            try {
                await fs.access(webTar);
                await execAsync(`tar -xzf "${webTar}" -C "${targetPath}"`);
                details.push('  ✅ Web files restored');
            } catch {
                details.push('  ℹ️  No web files in archive – skipping');
            }

            // ── 10. Start containers ─────────────────────────────────────────
            report(60, 'Starting containers …');
            await this.dockerService.startInstance(newInstanceName);
            // Wait a moment for the DB to become ready
            await new Promise(resolve => setTimeout(resolve, 8000));

            // ── 11. Restore DB dump ──────────────────────────────────────────
            const dbDumpPath = path.join(tmpDir, 'db-dump.sql');
            let dbRestored = false;
            try {
                await fs.access(dbDumpPath);
                report(75, 'Restoring database dump …');

                const dbContainerName = await this.dockerService.getDbContainerName(newInstanceName);
                if (dbContainerName) {
                    const envContent = await fs.readFile(envPath, 'utf8').catch(() => '');
                    const env: Record<string, string> = {};
                    envContent.split('\n').forEach(line => {
                        const eq = line.indexOf('=');
                        if (eq > 0) { env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim(); }
                    });
                    const rootPwd = env['DB_ROOT_PASSWORD'] || env['MYSQL_ROOT_PASSWORD'] || 'root';

                    // Copy dump into container and restore
                    await execAsync(`docker cp "${dbDumpPath}" "${dbContainerName}:/tmp/db-dump.sql"`);
                    await execAsync(
                        `docker exec "${dbContainerName}" sh -c "mysql -u root -p'${rootPwd}' < /tmp/db-dump.sql 2>/dev/null || mariadb -u root -p'${rootPwd}' < /tmp/db-dump.sql 2>/dev/null"`
                    );
                    details.push('  ✅ Database restored');
                    dbRestored = true;
                } else {
                    details.push('  ⚠️  DB container not found – skipping DB restore');
                }
            } catch {
                details.push('  ℹ️  No DB dump in archive – skipping');
            }

            // ── 12. Cleanup ──────────────────────────────────────────────────
            report(95, 'Cleaning up …');
            await fs.rm(tmpDir, { recursive: true, force: true });
            tmpDir = null;

            const msg = `Instance "${newInstanceName}" imported successfully! HTTP: ${newHttpPort}, HTTPS: ${newHttpsPort}`;
            if (!dbRestored) {
                details.push('\n⚠️  Database was not restored. Import the DB dump manually via Adminer if needed.');
            }
            report(100, msg);

            return { success: true, instanceName: newInstanceName, message: msg, details };

        } catch (err: any) {
            // Cleanup on error
            if (tmpDir) {
                await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
            }
            return { success: false, message: `Import failed: ${err.message}`, details };
        }
    }
}
