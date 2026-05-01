import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DockerService } from './dockerService';
import { PortManager } from './portManager';

const execAsync = promisify(exec);

export interface MaintenanceResult {
    success: boolean;
    message: string;
    details: string[];
}

/**
 * Service for housekeeping / maintenance operations across all REDAXO instances.
 *
 * Features:
 * - reorganizePorts: Detect port conflicts across instance .env files and reassign clean ports
 * - restartAllInstances: Stop + start every running instance sequentially
 * - pruneOrphanedResources: Remove Docker containers/volumes/networks that belong to no known instance
 */
export class MaintenanceService {

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
    // Port Reorganisation
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Scans all instance .env files for port assignments, detects duplicates,
     * reassigns conflicting ports and rewrites the affected .env files.
     * Stopped instances are NOT restarted automatically.
     */
    static async reorganizePorts(): Promise<MaintenanceResult> {
        const details: string[] = [];

        try {
            const instances = await this.dockerService.listInstances();
            if (instances.length === 0) {
                return { success: true, message: 'No instances found.', details: [] };
            }

            details.push(`Checking ${instances.length} instance(s) for port conflicts…`);

            const instancesDir = await this.dockerService.getInstancesDirectory();

            // Collect current port assignments: Map<port, instanceName[]>
            type PortMap = Map<number, string[]>;
            const httpPorts: PortMap  = new Map();
            const httpsPorts: PortMap = new Map();
            const mysqlPorts: PortMap = new Map();

            const envData: Array<{ name: string; envPath: string; vars: Record<string, string> }> = [];

            for (const inst of instances) {
                const envPath = path.join(instancesDir, inst.name, '.env');
                try {
                    const content = await fs.readFile(envPath, 'utf8');
                    const vars: Record<string, string> = {};
                    content.split('\n').forEach(line => {
                        const eqIdx = line.indexOf('=');
                        if (eqIdx > 0) {
                            const k = line.slice(0, eqIdx).trim();
                            const v = line.slice(eqIdx + 1).trim();
                            if (k) { vars[k] = v; }
                        }
                    });
                    envData.push({ name: inst.name, envPath, vars });

                    const addPort = (map: PortMap, portStr: string | undefined, instName: string) => {
                        if (!portStr) { return; }
                        const p = parseInt(portStr);
                        if (!isNaN(p)) {
                            if (!map.has(p)) { map.set(p, []); }
                            map.get(p)!.push(instName);
                        }
                    };
                    addPort(httpPorts,  vars['HTTP_PORT'],  inst.name);
                    addPort(httpsPorts, vars['HTTPS_PORT'], inst.name);
                    addPort(mysqlPorts, vars['MYSQL_PORT'], inst.name);
                } catch {
                    details.push(`  ⚠️  Could not read .env for ${inst.name} – skipping`);
                }
            }

            // Find conflicts (port used by > 1 instance)
            const conflicts: Array<{ port: number; instances: string[]; type: string }> = [];
            for (const [p, names] of httpPorts)  { if (names.length > 1) { conflicts.push({ port: p, instances: names, type: 'HTTP_PORT'  }); } }
            for (const [p, names] of httpsPorts) { if (names.length > 1) { conflicts.push({ port: p, instances: names, type: 'HTTPS_PORT' }); } }
            for (const [p, names] of mysqlPorts) { if (names.length > 1) { conflicts.push({ port: p, instances: names, type: 'MYSQL_PORT' }); } }

            if (conflicts.length === 0) {
                details.push('✅ No port conflicts detected – nothing to do.');
                return { success: true, message: 'No port conflicts found.', details };
            }

            details.push(`Found ${conflicts.length} conflict(s). Reassigning…`);

            // Track all currently assigned ports (to avoid reusing them)
            const usedPorts = new Set<number>([
                ...httpPorts.keys(),
                ...httpsPorts.keys(),
                ...mysqlPorts.keys(),
            ]);

            const getNextFree = async (start: number): Promise<number> => {
                let p = start;
                while (usedPorts.has(p)) { p++; }
                // Also check live system
                const livePort = await PortManager.findAvailablePort(p);
                usedPorts.add(livePort);
                return livePort;
            };

            // For each conflict keep the first instance's port, reassign others
            const reassigned: Array<{ instance: string; key: string; oldPort: number; newPort: number }> = [];

            for (const conflict of conflicts) {
                const [_keep, ...toFix] = conflict.instances;
                for (const instName of toFix) {
                    let startSearch = 8080;
                    if (conflict.type === 'HTTPS_PORT') { startSearch = 8443; }
                    if (conflict.type === 'MYSQL_PORT') { startSearch = 3306; }
                    const newPort = await getNextFree(startSearch);
                    reassigned.push({ instance: instName, key: conflict.type, oldPort: conflict.port, newPort });
                    details.push(`  🔧 ${instName}: ${conflict.type} ${conflict.port} → ${newPort}`);
                }
            }

            // Write updated .env files
            for (const change of reassigned) {
                const envEntry = envData.find(e => e.name === change.instance);
                if (!envEntry) { continue; }

                envEntry.vars[change.key] = String(change.newPort);
                // Also update HTTP_PORT alias used for frontendUrl etc.
                if (change.key === 'HTTP_PORT') { envEntry.vars['PORT'] = String(change.newPort); }

                const newContent = Object.entries(envEntry.vars)
                    .map(([k, v]) => `${k}=${v}`)
                    .join('\n') + '\n';
                await fs.writeFile(envEntry.envPath, newContent, 'utf8');

                // Also patch docker-compose.yml port mapping if present
                const composePath = path.join(instancesDir, change.instance, 'docker-compose.yml');
                try {
                    let compose = await fs.readFile(composePath, 'utf8');
                    compose = compose.replace(
                        new RegExp(`"${change.oldPort}:(80|443|3306)"`, 'g'),
                        (match, inner) => `"${change.newPort}:${inner}"`
                    );
                    compose = compose.replace(
                        new RegExp(`'${change.oldPort}:(80|443|3306)'`, 'g'),
                        (match, inner) => `'${change.newPort}:${inner}'`
                    );
                    await fs.writeFile(composePath, compose, 'utf8');
                } catch {
                    details.push(`  ⚠️  Could not patch docker-compose.yml for ${change.instance}`);
                }
            }

            const msg = `Port reorganisation complete: ${reassigned.length} port(s) reassigned.`;
            details.push(`\n✅ ${msg}`);
            details.push('Restart the affected instances for changes to take effect.');
            return { success: true, message: msg, details };

        } catch (err: any) {
            return { success: false, message: `Port reorganisation failed: ${err.message}`, details };
        }
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Restart All Instances
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Restarts every currently running instance (stop → start).
     * Stopped instances are left untouched unless restartStopped = true.
     */
    static async restartAllInstances(restartStopped = false): Promise<MaintenanceResult> {
        const details: string[] = [];

        try {
            const instances = await this.dockerService.listInstances();
            const targets = instances.filter(i => restartStopped ? true : i.running);

            if (targets.length === 0) {
                const msg = restartStopped ? 'No instances found.' : 'No running instances found.';
                return { success: true, message: msg, details: [msg] };
            }

            details.push(`Restarting ${targets.length} instance(s)…\n`);

            let ok = 0;
            let failed = 0;

            for (const inst of targets) {
                try {
                    details.push(`▶ Stopping  ${inst.name}…`);
                    await this.dockerService.stopInstance(inst.name);
                    details.push(`▶ Starting  ${inst.name}…`);
                    await this.dockerService.startInstance(inst.name);
                    details.push(`  ✅ ${inst.name} restarted\n`);
                    ok++;
                } catch (err: any) {
                    details.push(`  ❌ ${inst.name} failed: ${err.message}\n`);
                    failed++;
                }
            }

            const msg = `Restart complete: ${ok} succeeded, ${failed} failed.`;
            details.push(msg);
            return { success: failed === 0, message: msg, details };

        } catch (err: any) {
            return { success: false, message: `Restart failed: ${err.message}`, details };
        }
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Prune Orphaned Docker Resources
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Identifies Docker containers, volumes and networks whose names start with
     * "redaxo-" but whose corresponding instance directory no longer exists.
     * After confirmation by the user, removes them.
     */
    static async pruneOrphanedResources(): Promise<MaintenanceResult> {
        const details: string[] = [];

        try {
            const instancesDir = await this.dockerService.getInstancesDirectory();
            const entries = await fs.readdir(instancesDir, { withFileTypes: true });
            const knownNames = new Set(
                entries.filter(e => e.isDirectory()).map(e => e.name)
            );

            details.push(`Known instances: ${[...knownNames].join(', ') || 'none'}\n`);

            // ── Containers ──────────────────────────────────────────────────────
            const { stdout: psOut } = await execAsync(
                'docker ps -a --format "{{.Names}}" 2>/dev/null || true'
            );
            const allContainers = psOut.split('\n').map(s => s.trim()).filter(Boolean);
            const orphanContainers = allContainers.filter(name => {
                if (!name.startsWith('redaxo-')) { return false; }
                // Container name pattern: redaxo-<instanceName>-web, redaxo-<instanceName>-mysql, etc.
                const parts = name.split('-');
                if (parts.length < 3) { return false; }
                const instanceName = parts.slice(1, -1).join('-');
                return !knownNames.has(instanceName);
            });

            // ── Volumes ─────────────────────────────────────────────────────────
            const { stdout: volOut } = await execAsync(
                'docker volume ls --format "{{.Name}}" 2>/dev/null || true'
            );
            const allVolumes = volOut.split('\n').map(s => s.trim()).filter(Boolean);
            const orphanVolumes = allVolumes.filter(name => {
                if (!name.startsWith('redaxo-') && !name.match(/^[a-z0-9_]+-[a-z0-9_]+_/)) { return false; }
                // Volume name pattern: <instanceName>_data or redaxo-<instanceName>_data
                const match = name.match(/^(?:redaxo-)?([^_]+)_/);
                if (!match) { return false; }
                return !knownNames.has(match[1]);
            });

            // ── Networks ────────────────────────────────────────────────────────
            const { stdout: netOut } = await execAsync(
                'docker network ls --format "{{.Name}}" 2>/dev/null || true'
            );
            const allNetworks = netOut.split('\n').map(s => s.trim()).filter(Boolean);
            const systemNets = new Set(['bridge', 'host', 'none', 'adminer-network']);
            const orphanNetworks = allNetworks.filter(name => {
                if (systemNets.has(name)) { return false; }
                if (!name.startsWith('redaxo-') && !name.includes('_default')) { return false; }
                const match = name.match(/^(?:redaxo-)?([^_-]+)/);
                if (!match) { return false; }
                return !knownNames.has(match[1]);
            });

            const totalOrphans = orphanContainers.length + orphanVolumes.length + orphanNetworks.length;

            if (totalOrphans === 0) {
                details.push('✅ No orphaned Docker resources found.');
                return { success: true, message: 'No orphaned resources found.', details };
            }

            if (orphanContainers.length > 0) {
                details.push(`Orphaned containers (${orphanContainers.length}):`);
                orphanContainers.forEach(c => details.push(`  - ${c}`));
            }
            if (orphanVolumes.length > 0) {
                details.push(`Orphaned volumes (${orphanVolumes.length}):`);
                orphanVolumes.forEach(v => details.push(`  - ${v}`));
            }
            if (orphanNetworks.length > 0) {
                details.push(`Orphaned networks (${orphanNetworks.length}):`);
                orphanNetworks.forEach(n => details.push(`  - ${n}`));
            }

            // Return the analysis; caller decides whether to delete
            return {
                success: true,
                message: `Found ${totalOrphans} orphaned resource(s).`,
                details: [
                    ...details,
                    '__ORPHAN_DATA__', // sentinel parsed by the command handler
                    JSON.stringify({ orphanContainers, orphanVolumes, orphanNetworks })
                ]
            };

        } catch (err: any) {
            return { success: false, message: `Prune failed: ${err.message}`, details };
        }
    }

    /**
     * Actually removes the previously identified orphaned resources.
     */
    static async deleteOrphanedResources(
        containers: string[],
        volumes: string[],
        networks: string[]
    ): Promise<MaintenanceResult> {
        const details: string[] = [];
        let errors = 0;

        for (const c of containers) {
            try {
                await execAsync(`docker rm -f "${c}"`);
                details.push(`  🗑️  Removed container: ${c}`);
            } catch (err: any) {
                details.push(`  ❌ Failed to remove container ${c}: ${err.message}`);
                errors++;
            }
        }

        for (const v of volumes) {
            try {
                await execAsync(`docker volume rm "${v}"`);
                details.push(`  🗑️  Removed volume: ${v}`);
            } catch (err: any) {
                details.push(`  ❌ Failed to remove volume ${v}: ${err.message}`);
                errors++;
            }
        }

        for (const n of networks) {
            try {
                await execAsync(`docker network rm "${n}"`);
                details.push(`  🗑️  Removed network: ${n}`);
            } catch (err: any) {
                details.push(`  ❌ Failed to remove network ${n}: ${err.message}`);
                errors++;
            }
        }

        const total = containers.length + volumes.length + networks.length;
        const removed = total - errors;
        const msg = `Removed ${removed}/${total} orphaned resource(s).`;
        details.push(`\n${errors === 0 ? '✅' : '⚠️'} ${msg}`);
        return { success: errors === 0, message: msg, details };
    }
}
