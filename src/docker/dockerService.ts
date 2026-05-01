import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { RedaxoInstance, CreateInstanceOptions, DatabaseInfo } from '../types/redaxo';
import { DockerComposeGenerator } from './dockerCompose';
import { SSLManager } from './sslManager';
import { PortManager } from './portManager';
import { SetupTemplates } from './templates';
import { RedaxoConsoleService } from './redaxoConsoleService';
import { DatabaseQueryService } from './databaseQueryService';
import { FileSystemService } from './fileSystemService';

const execPromise = promisify(exec);

export class DockerService {
    private dockerPath: string;
    private instancesDir: string | null = null;
    private outputChannel?: vscode.OutputChannel;

    constructor(outputChannel?: vscode.OutputChannel) {
        this.dockerPath = vscode.workspace.getConfiguration('redaxo-instances').get('dockerPath', 'docker');
        this.outputChannel = outputChannel;
    }

    private log(message: string): void {
        console.log(message);
        if (this.outputChannel) {
            this.outputChannel.appendLine(message);
        }
    }

    private async runDockerCommand(args: string[], options?: { cwd?: string }): Promise<string> {
        const command = `${this.dockerPath} ${args.join(' ')}`;
        this.log(`🐳 Running Docker command: ${command}`);
        this.log(`📁 Working directory: ${options?.cwd || 'default'}`);
        
        try {
            const { stdout, stderr } = await execPromise(command, options);
            const stderrStr = stderr?.toString() || '';
            const stdoutStr = stdout?.toString() || '';
            
            if (stderrStr && stderrStr.trim()) {
                this.log(`⚠️  Docker command stderr: ${stderrStr}`);
            }
            if (stdoutStr && stdoutStr.trim()) {
                this.log(`✅ Docker command completed successfully`);
            }
            return stdoutStr;
        } catch (error) {
            this.log(`❌ Docker command failed: ${command}`);
            this.log(`💥 Error: ${error}`);
            throw error;
        }
    }

    public async getInstancesDirectory(): Promise<string> {
        if (this.instancesDir) {
            return this.instancesDir;
        }

        const config = vscode.workspace.getConfiguration('redaxo-instances');
        let instancesPath = config.get<string>('instancesPath');
        
        if (!instancesPath) {
            // Always ask user to select instances directory
            const selectedPath = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select Instances Folder',
                title: 'Choose folder for REDAXO instances',
                defaultUri: vscode.Uri.file(require('os').homedir())
            });

            if (!selectedPath || selectedPath.length === 0) {
                throw new Error('No instances folder selected. Please select a folder to store REDAXO instances.');
            }

            instancesPath = selectedPath[0].fsPath;
            
            // Save the path for future use
            await config.update('instancesPath', instancesPath, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Instances folder set to: ${instancesPath}`);
        }

        await fs.mkdir(instancesPath, { recursive: true });
        this.instancesDir = instancesPath;
        return instancesPath;
    }

    async changeInstancesDirectory(): Promise<string> {
        const selectedPath = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select New Instances Folder',
            title: 'Choose new folder for REDAXO instances',
            defaultUri: vscode.Uri.file(this.instancesDir || require('os').homedir())
        });

        if (!selectedPath || selectedPath.length === 0) {
            throw new Error('No folder selected. Instances path not changed.');
        }

        const newInstancesPath = selectedPath[0].fsPath;
        const config = vscode.workspace.getConfiguration('redaxo-instances');
        await config.update('instancesPath', newInstancesPath, vscode.ConfigurationTarget.Global);
        
        // Clear the cached directory path so it gets refreshed
        this.instancesDir = null;
        
        // Set the new path and create directory if needed
        this.instancesDir = newInstancesPath;
        await fs.mkdir(newInstancesPath, { recursive: true });
        
        vscode.window.showInformationMessage(`Instances folder changed to: ${newInstancesPath}`);
        
        return newInstancesPath;
    }

    async createInstance(options: CreateInstanceOptions): Promise<void> {
        try {
            this.log(`🚀 Creating REDAXO instance: ${options.name}`);
            this.log(`📋 Configuration: ${JSON.stringify(options, null, 2)}`);
            
            const instancesDir = await this.getInstancesDirectory();
            const instancePath = path.join(instancesDir, options.name);
            
            // Check if instance already exists
            try {
                await fs.access(instancePath);
                throw new Error(`Instance '${options.name}' already exists`);
            } catch (error: any) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }
            
            // Create instance directory
            await fs.mkdir(instancePath, { recursive: true });
            
            // Generate passwords and find available ports
            this.log(`🔍 Prüfe verfügbare Ports...`);
            PortManager.showPortUsage(); // Zeige aktuelle Port-Nutzung
            
            const dbRootPassword = PortManager.generateRandomPassword();
            const dbPassword = PortManager.generateRandomPassword(12);
            const [httpPort, httpsPort] = await PortManager.findAvailablePortRange();
            const mysqlPort = await PortManager.findAvailablePort(3306);
            
            this.log(`🌐 Zugewiesene Ports - HTTP: ${httpPort}, HTTPS: ${httpsPort}, MySQL: ${mysqlPort}`);
            
            // Setup SSL certificates
            this.log(`🔒 Setting up SSL certificates with mkcert...`);
            const sslEnabled = await SSLManager.setupSSLCertificates(options.name, instancePath);
            this.log(`🔒 SSL certificates ${sslEnabled ? 'created successfully' : 'not available (mkcert not found)'}`);
            
            // Create docker-compose.yml
            this.log(`⚙️  Creating Docker Compose configuration...`);
            const dockerComposeContent = DockerComposeGenerator.generate(options, dbPassword, dbRootPassword, httpPort, httpsPort, mysqlPort, sslEnabled);
            await fs.writeFile(path.join(instancePath, 'docker-compose.yml'), dockerComposeContent);
            
            // Create .env file
            this.log(`📝 Creating environment configuration...`);
            const envContent = DockerComposeGenerator.generateEnvFile(options, dbPassword, dbRootPassword, httpPort, httpsPort, mysqlPort, sslEnabled);
            await fs.writeFile(path.join(instancePath, '.env'), envContent);
            
            // Create data directories
            this.log(`📁 Setting up data directories...`);
            await fs.mkdir(path.join(instancePath, 'data'), { recursive: true });
            await fs.mkdir(path.join(instancePath, 'data', 'mysql'), { recursive: true });
            await fs.mkdir(path.join(instancePath, 'data', 'redaxo'), { recursive: true });
            await fs.mkdir(path.join(instancePath, 'mysql-init'), { recursive: true });
            
            // Create custom setup script for REDAXO auto-installation
            this.log(`🛠️  Creating REDAXO setup script...`);
            const customSetupContent = this.generateSetupScript(options);
            await fs.writeFile(path.join(instancePath, 'custom-setup.sh'), customSetupContent, { mode: 0o755 });
            
            // Pull Docker images first
            this.log(`🐳 Pulling required Docker images (this may take a while)...`);
            await this.runDockerCommand(['compose', 'pull'], { cwd: instancePath });
            
            this.log(`✅ Instance ${options.name} created successfully!`);
            vscode.window.showInformationMessage(`Instance ${options.name} created successfully! You can start it manually when ready.`);
            
            this.log(`🎯 Instance is ready to start. Use 'Start Instance' from the context menu when ready.`);
            this.log(`🎯 Note: The instance needs to be started manually to ensure all files are properly initialized.`);
            
        } catch (error) {
            console.error('DockerService: Error in createInstance:', error);
            this.log(`❌ Error creating instance: ${error}`);
            
            let errorMessage = 'Unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }
            
            if (errorMessage.includes('not found') || errorMessage.includes('command not found')) {
                errorMessage += ' (Docker or required command not found)';
            }
            
            vscode.window.showErrorMessage(`Instance creation failed: ${errorMessage}`);
            throw new Error(`Instance creation failed: ${errorMessage}`);
        }
    }

    async startInstance(instanceName: string): Promise<void> {
        try {
            const instancesDir = await this.getInstancesDirectory();
            const instancePath = path.join(instancesDir, instanceName);
            
            this.log(`🚀 Starting instance: ${instanceName}`);
            await this.runDockerCommand(['compose', 'up', '-d'], { cwd: instancePath });
            this.log(`✅ Instance ${instanceName} started successfully`);
            
            vscode.window.showInformationMessage(`Instance ${instanceName} started successfully!`);
        } catch (error: any) {
            this.log(`❌ Failed to start instance: ${error.message}`);
            vscode.window.showErrorMessage(`Failed to start instance: ${error.message}`);
            throw error;
        }
    }

    async stopInstance(instanceName: string): Promise<void> {
        try {
            const instancesDir = await this.getInstancesDirectory();
            const instancePath = path.join(instancesDir, instanceName);
            
            this.log(`🛑 Stopping instance: ${instanceName}`);
            await this.runDockerCommand(['compose', 'stop'], { cwd: instancePath });
            this.log(`✅ Instance ${instanceName} stopped successfully`);
            
            vscode.window.showInformationMessage(`Instance ${instanceName} stopped successfully!`);
        } catch (error: any) {
            this.log(`❌ Failed to stop instance: ${error.message}`);
            vscode.window.showErrorMessage(`Failed to stop instance: ${error.message}`);
            throw error;
        }
    }

    async deleteInstance(instanceName: string): Promise<void> {
        try {
            const instancesDir = await this.getInstancesDirectory();
            const instancePath = path.join(instancesDir, instanceName);
            
            // Stop containers first
            try {
                await execPromise('docker-compose down -v', { cwd: instancePath });
            } catch {
                // Continue even if stopping fails
            }
            
            // Remove instance directory
            await fs.rm(instancePath, { recursive: true, force: true });
            vscode.window.showInformationMessage(`Instance ${instanceName} deleted successfully!`);
            
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to delete instance: ${error.message}`);
            throw error;
        }
    }

    async getInstance(instanceName: string): Promise<RedaxoInstance | null> {
        try {
            const instancesDir = await this.getInstancesDirectory();
            const instancePath = path.join(instancesDir, instanceName);
            
            // Check if instance exists
            try {
                await fs.access(instancePath);
            } catch {
                return null;
            }
            
            // Read configuration
            const configPath = path.join(instancePath, '.env');
            let config: any = {};
            
            try {
                const configContent = await fs.readFile(configPath, 'utf8');
                // Parse simple KEY=VALUE format
                configContent.split('\n').forEach(line => {
                    const [key, value] = line.split('=');
                    if (key && value) {
                        config[key.trim()] = value.trim();
                    }
                });
            } catch {
                // Config file doesn't exist or can't be read
            }
            
            // Determine instance type: standard REDAXO vs custom
            let instanceType: 'standard' | 'custom' = 'custom'; // Default to custom
            if (config.RELEASE_TYPE) {
                instanceType = 'standard'; // Has RELEASE_TYPE = standard REDAXO instance
            }

            return {
                name: instanceName,
                path: instancePath,
                running: (await this.getInstanceStatus(instanceName)) === 'running',
                status: await this.getInstanceStatus(instanceName),
                phpVersion: config.PHP_VERSION || '8.2',
                mariadbVersion: config.MARIADB_VERSION || 'latest',
                port: parseInt(config.HTTP_PORT) || 8080, // Backward compatibility
                httpPort: parseInt(config.HTTP_PORT) || 8080,
                httpsPort: config.SSL_ENABLED === 'true' ? (parseInt(config.HTTPS_PORT) || 8443) : undefined,
                frontendUrl: `http://localhost:${config.HTTP_PORT || 8080}`,
                backendUrl: `http://localhost:${config.HTTP_PORT || 8080}/redaxo`,
                frontendUrlHttps: config.SSL_ENABLED === 'true' ? `https://${instanceName}.local:${config.HTTPS_PORT || 8443}` : undefined,
                backendUrlHttps: config.SSL_ENABLED === 'true' ? `https://${instanceName}.local:${config.HTTPS_PORT || 8443}/redaxo` : undefined,
                frontendUrlHttpsLocalhost: config.SSL_ENABLED === 'true' ? `https://localhost:${config.HTTPS_PORT || 8443}` : undefined,
                backendUrlHttpsLocalhost: config.SSL_ENABLED === 'true' ? `https://localhost:${config.HTTPS_PORT || 8443}/redaxo` : undefined,
                instanceType: instanceType
            };
        } catch (error) {
            console.error('Error getting instance:', error);
            return null;
        }
    }

    async getInstanceStatus(instanceName: string): Promise<'running' | 'stopped' | 'creating' | 'error' | undefined> {
        try {
            const instancesDir = await this.getInstancesDirectory();
            const instancePath = path.join(instancesDir, instanceName);
            
            // Check if docker-compose.yml exists first
            const dockerComposePath = path.join(instancePath, 'docker-compose.yml');
            try {
                await fs.access(dockerComposePath);
            } catch {
                // docker-compose.yml doesn't exist, instance not fully created yet
                return 'stopped';
            }
            
            const result = await this.runDockerCommand(['compose', 'ps', '--services', '--filter', 'status=running'], { cwd: instancePath });
            return result.trim().length > 0 ? 'running' : 'stopped';
        } catch (error: any) {
            this.log(`⚠️ Error checking status for ${instanceName}: ${error.message}`);
            return 'error';
        }
    }

    async listInstances(): Promise<RedaxoInstance[]> {
        try {
            const instancesDir = await this.getInstancesDirectory();
            const entries = await fs.readdir(instancesDir, { withFileTypes: true });
            
            const instances: RedaxoInstance[] = [];
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const instance = await this.getInstance(entry.name);
                    if (instance) {
                        instances.push(instance);
                    }
                }
            }
            
            return instances;
        } catch (error) {
            console.error('Error listing instances:', error);
            return [];
        }
    }

    async getDatabaseInfo(instanceName: string): Promise<DatabaseInfo | null> {
        try {
            const instance = await this.getInstance(instanceName);
            if (!instance) {
                return null;
            }

            const instancesDir = await this.getInstancesDirectory();
            const instancePath = path.join(instancesDir, instanceName);
            const configPath = path.join(instancePath, '.env');
            
            let config: any = {};
            try {
                const configContent = await fs.readFile(configPath, 'utf8');
                configContent.split('\n').forEach(line => {
                    const [key, value] = line.split('=');
                    if (key && value) {
                        config[key.trim()] = value.trim();
                    }
                });
            } catch {
                return null;
            }

            return {
                host: config.DB_HOST || 'mysql',
                database: config.DB_NAME || 'redaxo',
                user: config.DB_USER || 'redaxo',
                password: config.DB_PASSWORD || '',
                rootPassword: config.DB_ROOT_PASSWORD || ''
            };
        } catch (error) {
            console.error('Error getting database info:', error);
            return null;
        }
    }

    async checkDockerInstallation(): Promise<boolean> {
        try {
            await this.runDockerCommand(['--version']);
            return true;
        } catch {
            return false;
        }
    }

    async getLoginInfo(instanceName: string): Promise<any> {
        try {
            const instancesDir = await this.getInstancesDirectory();
            const instancePath = path.join(instancesDir, instanceName);
            
            // Check if instance is running
            const status = await this.getInstanceStatus(instanceName);
            const isRunning = status === 'running';
            
            // Read .env file
            const envPath = path.join(instancePath, '.env');
            const envContent = await fs.readFile(envPath, 'utf8');
            
            // Parse environment variables
            const envVars: any = {};
            envContent.split('\n').forEach(line => {
                const [key, value] = line.split('=');
                if (key && value) {
                    envVars[key.trim()] = value.trim();
                }
            });
            
            // Read docker-compose.yml to get port information
            const composePath = path.join(instancePath, 'docker-compose.yml');
            const composeContent = await fs.readFile(composePath, 'utf8');
            
            // Check if this is a custom instance by looking for docker-compose.yml structure
            // Support both old format (instance_web) and new format (instanceweb)
            const isCustomInstance = composeContent.includes(`${instanceName}_web`) && composeContent.includes(`${instanceName}_db`) ||
                                    composeContent.includes(`${instanceName.replace(/_/g, '')}web`) && composeContent.includes(`${instanceName.replace(/_/g, '')}db`);
            
            // Extract ports from docker-compose
            const httpPortMatch = composeContent.match(/"(\d+):80"/);
            const httpsPortMatch = composeContent.match(/"(\d+):443"/);
            const mysqlPortMatch = composeContent.match(/"(\d+):3306"/);
            
            const httpPort = httpPortMatch ? httpPortMatch[1] : '80';
            const httpsPort = httpsPortMatch ? httpsPortMatch[1] : '443';
            const mysqlPort = mysqlPortMatch ? mysqlPortMatch[1] : null;
            
            // Build URLs with correct port selection based on SSL
            const sslEnabled = envVars.SSL_ENABLED === 'true';
            const frontendUrl = `http://localhost:${httpPort}`;
            const backendUrl = isCustomInstance ? `http://localhost:${httpPort}` : `http://localhost:${httpPort}/redaxo`;
            let frontendUrlHttps = null;
            let backendUrlHttps = null;
            
            if (sslEnabled) {
                frontendUrlHttps = `https://${instanceName}.local:${httpsPort}`;
                backendUrlHttps = isCustomInstance ? `https://${instanceName}.local:${httpsPort}` : `https://${instanceName}.local:${httpsPort}/redaxo`;
            }
            
            // Primary URLs - use HTTPS if SSL is enabled, otherwise HTTP
            const primaryFrontendUrl = sslEnabled ? frontendUrlHttps : frontendUrl;
            const primaryBackendUrl = sslEnabled ? backendUrlHttps : backendUrl;

            // Database credentials based on instance type
            let dbHost, dbName, dbUser, dbPassword, dbRootPassword, dbExternalHost, dbExternalPort;
            if (isCustomInstance) {
                // Custom instances use instanceName for all DB credentials
                dbHost = `${instanceName.replace(/_/g, '')}db`; // Remove underscores for DNS compliance
                dbName = instanceName;
                dbUser = instanceName;
                dbPassword = instanceName; // Custom instances: password = instance name
                dbRootPassword = 'root'; // Custom instances use 'root' as root password
                // Extract custom instance MySQL port from docker-compose.yml
                const customPortMatch = composeContent.match(/"(\d+):3306"/);
                dbExternalHost = 'localhost';
                dbExternalPort = customPortMatch ? customPortMatch[1] : '3306';
            } else {
                // Standard REDAXO instances use standard credentials
                dbHost = envVars.DB_HOST || 'mysql';
                dbName = envVars.DB_NAME || 'redaxo';
                dbUser = envVars.DB_USER || 'redaxo';
                dbPassword = envVars.DB_PASSWORD || envVars.MYSQL_PASSWORD || 'N/A';
                dbRootPassword = envVars.DB_ROOT_PASSWORD || envVars.MYSQL_ROOT_PASSWORD || 'N/A';
                // External connection
                dbExternalHost = 'localhost';
                dbExternalPort = mysqlPort || '3306'; // Use extracted port from docker-compose.yml
            }
            
            return {
                running: isRunning,
                instanceName: instanceName,
                instanceType: isCustomInstance ? 'custom' : 'redaxo',
                
                // URLs
                primaryFrontendUrl,
                primaryBackendUrl,
                frontendUrl,
                backendUrl,
                frontendUrlHttps,
                backendUrlHttps,
                
                // Login credentials (only for REDAXO instances)
                adminUser: isCustomInstance ? 'N/A (Custom Instance)' : 'admin',
                adminPassword: isCustomInstance ? 'N/A (Custom Instance)' : (envVars.DB_PASSWORD || envVars.MYSQL_PASSWORD || 'N/A'),
                
                // Database info (internal)
                dbHost,
                dbName,
                dbUser,
                dbPassword,
                dbRootPassword,
                
                // Database info (external connection)
                dbExternalHost,
                dbExternalPort,
                
                // System info
                phpVersion: envVars.PHP_VERSION || 'N/A',
                mariadbVersion: envVars.MARIADB_VERSION || 'N/A',
                releaseType: envVars.RELEASE_TYPE || (isCustomInstance ? 'custom' : 'standard'),
                httpPort,
                httpsPort: sslEnabled ? httpsPort : null,
                sslEnabled
            };
            
        } catch (error: any) {
            this.log(`❌ Failed to get login info: ${error.message}`);
            throw error;
        }
    }

    // importDump removed — DB import/export should be done via Adminer or external tools

    async setupInstanceSSL(instanceName: string): Promise<void> {
        try {
            const instancesDir = await this.getInstancesDirectory();
            const instancePath = path.join(instancesDir, instanceName);
            
            // Read release type from .env file
            const configPath = path.join(instancePath, '.env');
            let releaseType = 'standard';
            try {
                const configContent = await fs.readFile(configPath, 'utf8');
                const releaseMatch = configContent.match(/RELEASE_TYPE=(.+)/);
                if (releaseMatch) {
                    releaseType = releaseMatch[1].trim();
                }
            } catch {
                // Default to standard if can't read config
            }
            
            this.log(`🔒 Setting up SSL for instance: ${instanceName}`);
            const sslEnabled = await SSLManager.setupSSLCertificates(instanceName, instancePath, releaseType);
            
            if (sslEnabled) {
                this.log(`✅ SSL setup completed for ${instanceName}`);
                vscode.window.showInformationMessage(`SSL certificates created successfully for ${instanceName}!`);
            } else {
                this.log(`❌ SSL setup failed for ${instanceName}`);
                vscode.window.showWarningMessage(`SSL setup failed. Make sure mkcert is installed.`);
            }
        } catch (error: any) {
            this.log(`❌ Failed to setup SSL: ${error.message}`);
            vscode.window.showErrorMessage(`Failed to setup SSL: ${error.message}`);
            throw error;
        }
    }

    async repairInstance(instanceName: string): Promise<void> {
        try {
            const instancesDir = await this.getInstancesDirectory();
            const instancePath = path.join(instancesDir, instanceName);
            
            this.log(`🔧 Repairing instance: ${instanceName}`);
            
            // Stop the instance first if running
            try {
                await this.runDockerCommand(['compose', 'down'], { cwd: instancePath });
                this.log(`🛑 Instance stopped for repair`);
            } catch (error) {
                this.log(`⚠️ Instance was not running`);
            }
            
            // Start MySQL temporarily to clean the database
            this.log(`🧹 Cleaning database for fresh installation...`);
            try {
                await this.runDockerCommand(['compose', 'up', '-d', 'mysql'], { cwd: instancePath });
                
                // Wait for MySQL to be ready
                let retries = 0;
                while (retries < 30) {
                    try {
                        await this.runDockerCommand(['compose', 'exec', 'mysql', 'mysqladmin', 'ping', '-h', 'localhost', '--silent'], { cwd: instancePath });
                        break;
                    } catch {
                        retries++;
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
                
                // Clean entire database for fresh installation
                await this.runDockerCommand(['compose', 'exec', 'mysql', 'mysql', '-u', 'redaxo', '-predaxo', 'redaxo', '-e', 
                    'SET FOREIGN_KEY_CHECKS = 0; ' +
                    'DROP DATABASE IF EXISTS redaxo; ' +
                    'CREATE DATABASE redaxo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; ' +
                    'SET FOREIGN_KEY_CHECKS = 1;'
                ], { cwd: instancePath });
                
                this.log(`🗑️ Database completely cleaned for fresh installation`);
                
                // Stop MySQL again
                await this.runDockerCommand(['compose', 'down'], { cwd: instancePath });
            } catch (error: any) {
                this.log(`⚠️ Database cleanup failed, continuing with rebuild: ${error.message}`);
            }
            
            // Rebuild containers with no cache to ensure fresh setup
            this.log(`🔧 Rebuilding containers...`);
            await this.runDockerCommand(['compose', 'build', '--no-cache'], { cwd: instancePath });
            await this.runDockerCommand(['compose', 'up', '-d', '--force-recreate'], { cwd: instancePath });
            
            this.log(`✅ Instance ${instanceName} repaired with clean database`);
            vscode.window.showInformationMessage(`Instance ${instanceName} repaired successfully! Database cleaned for fresh REDAXO installation.`);
        } catch (error: any) {
            this.log(`❌ Failed to repair instance: ${error.message}`);
            vscode.window.showErrorMessage(`Failed to repair instance: ${error.message}`);
            throw error;
        }
    }

    async changeInstancePhpVersion(instanceName: string, phpVersion: string): Promise<void> {
        try {
            const supportedVersions = ['7.4', '8.0', '8.1', '8.2', '8.3', '8.4', '8.5'];
            if (!supportedVersions.includes(phpVersion)) {
                throw new Error(`Unsupported PHP version: ${phpVersion}`);
            }

            const instancesDir = await this.getInstancesDirectory();
            const instancePath = path.join(instancesDir, instanceName);
            const composePath = path.join(instancePath, 'docker-compose.yml');
            const envPath = path.join(instancePath, '.env');
            const dockerfilePath = path.join(instancePath, 'Dockerfile');

            const instance = await this.getInstance(instanceName);
            if (!instance) {
                throw new Error(`Instance ${instanceName} not found`);
            }

            const composeContent = await fs.readFile(composePath, 'utf8');
            const hasBuildConfig = composeContent.includes('build:') && composeContent.includes('PHP_VERSION:');
            const isCustom = instance.instanceType === 'custom' || hasBuildConfig;

            if (!isCustom) {
                throw new Error('PHP version switch is currently only supported for custom instances (with Dockerfile/build args).');
            }

            // Update .env (used by UI and login info)
            try {
                let envContent = await fs.readFile(envPath, 'utf8');
                if (/^PHP_VERSION=.*$/m.test(envContent)) {
                    envContent = envContent.replace(/^PHP_VERSION=.*$/m, `PHP_VERSION=${phpVersion}`);
                } else {
                    envContent += `\nPHP_VERSION=${phpVersion}\n`;
                }
                await fs.writeFile(envPath, envContent, 'utf8');
            } catch {
                this.log(`⚠️ Could not update .env for ${instanceName}`);
            }

            // Update docker-compose build arg if present
            let updatedCompose = composeContent;
            if (/PHP_VERSION:\s*[0-9.]+/m.test(updatedCompose)) {
                updatedCompose = updatedCompose.replace(/PHP_VERSION:\s*[0-9.]+/m, `PHP_VERSION: ${phpVersion}`);
                await fs.writeFile(composePath, updatedCompose, 'utf8');
            }

            // Validate Dockerfile exists for custom rebuild workflow
            try {
                await fs.access(dockerfilePath);
            } catch {
                throw new Error('No Dockerfile found. PHP version switch requires a custom Dockerfile-based instance.');
            }

            const wasRunning = (await this.getInstanceStatus(instanceName)) === 'running';

            this.log(`🐘 Changing PHP version for ${instanceName} to ${phpVersion}`);
            this.log(`🛑 Stopping instance before rebuild...`);
            await this.runDockerCommand(['compose', 'down'], { cwd: instancePath });

            this.log(`🔨 Rebuilding web image with PHP ${phpVersion}...`);
            await this.runDockerCommand(['compose', 'build', '--no-cache', 'web'], { cwd: instancePath });

            if (wasRunning) {
                this.log(`🚀 Restarting instance after PHP switch...`);
                await this.runDockerCommand(['compose', 'up', '-d'], { cwd: instancePath });
            }

            this.log(`✅ PHP version for ${instanceName} changed to ${phpVersion}`);
        } catch (error: any) {
            this.log(`❌ Failed to change PHP version: ${error.message}`);
            throw error;
        }
    }

    async changeInstanceMariaDbVersion(instanceName: string, mariaDbVersion: string): Promise<void> {
        try {
            const supportedVersions = ['10.6', '10.11', '11.4', '11.8', '12.2'];
            if (!supportedVersions.includes(mariaDbVersion)) {
                throw new Error(`Unsupported MariaDB version: ${mariaDbVersion}`);
            }

            const instancesDir = await this.getInstancesDirectory();
            const instancePath = path.join(instancesDir, instanceName);
            const composePath = path.join(instancePath, 'docker-compose.yml');
            const envPath = path.join(instancePath, '.env');

            const instance = await this.getInstance(instanceName);
            if (!instance) {
                throw new Error(`Instance ${instanceName} not found`);
            }

            const composeContent = await fs.readFile(composePath, 'utf8');

            // Keep .env in sync for UI/login information
            try {
                let envContent = await fs.readFile(envPath, 'utf8');
                if (/^MARIADB_VERSION=.*$/m.test(envContent)) {
                    envContent = envContent.replace(/^MARIADB_VERSION=.*$/m, `MARIADB_VERSION=${mariaDbVersion}`);
                } else {
                    envContent += `\nMARIADB_VERSION=${mariaDbVersion}\n`;
                }
                await fs.writeFile(envPath, envContent, 'utf8');
            } catch {
                this.log(`⚠️ Could not update .env for ${instanceName}`);
            }

            // Update hardcoded MariaDB image tag in docker-compose if present
            let updatedCompose = composeContent;
            if (/image:\s*mariadb:[^\s]+/m.test(updatedCompose)) {
                updatedCompose = updatedCompose.replace(/image:\s*mariadb:[^\s]+/m, `image: mariadb:${mariaDbVersion}`);
            }
            await fs.writeFile(composePath, updatedCompose, 'utf8');

            const wasRunning = (await this.getInstanceStatus(instanceName)) === 'running';

            this.log(`🗄️ Changing MariaDB version for ${instanceName} to ${mariaDbVersion}`);
            this.log(`🛑 Stopping instance before database image switch...`);
            await this.runDockerCommand(['compose', 'down'], { cwd: instancePath });

            this.log(`📦 Pulling MariaDB ${mariaDbVersion} image...`);
            await this.runDockerCommand(['compose', 'pull', 'mysql'], { cwd: instancePath });

            if (wasRunning) {
                this.log(`🚀 Restarting instance after MariaDB switch...`);
                await this.runDockerCommand(['compose', 'up', '-d'], { cwd: instancePath });
            }

            this.log(`✅ MariaDB version for ${instanceName} changed to ${mariaDbVersion}`);
        } catch (error: any) {
            this.log(`❌ Failed to change MariaDB version: ${error.message}`);
            throw error;
        }
    }

    /**
     * Generate setup script for a REDAXO instance
     */
    private generateSetupScript(options: CreateInstanceOptions): string {
        return `#!/bin/bash
# REDAXO Instance Setup Script for ${options.name}

# Check if setup already completed
if [ -f "/tmp/setup-complete.flag" ]; then
    echo "✅ Setup already completed - skipping"
    exit 0
fi

${SetupTemplates.generateCustomSetupScript(options.name, options.phpVersion, false)}

${options.autoInstall ? SetupTemplates.generateAutoInstallScript(options.name, options.phpVersion, false) : SetupTemplates.generateEmptyInstanceScript(options.name, options.phpVersion)}

# Mark setup as complete
touch /tmp/setup-complete.flag

echo "✅ Instance setup complete!"
`;
    }
    
    // ========================================
    // Public accessors for communication services
    // ========================================
    
    /**
     * Get the REDAXO Console Service for executing console commands
     */
    get console() {
        return RedaxoConsoleService;
    }
    
    /**
     * Get the Database Query Service for database operations
     */
    get database() {
        return DatabaseQueryService;
    }
    
    /**
     * Get the File System Service for file operations
     */
    get fileSystem() {
        return FileSystemService;
    }
    
    /**
     * Get the actual web container name for an instance
     * Handles both standard REDAXO instances (redaxo-{name}) and custom instances ({name}web)
     */
    async getWebContainerName(instanceName: string): Promise<string | null> {
        try {
            // Try standard REDAXO naming first
            const standardName = `redaxo-${instanceName}`;
            const { stdout: stdCheck } = await execPromise(`docker ps -a --filter "name=^${standardName}$" --format "{{.Names}}"`);
            if (stdCheck.trim() === standardName) {
                return standardName;
            }
            
            // Try custom instance naming patterns
            const patterns = [
                `${instanceName}web`,
                `${instanceName}-web`,
                `${instanceName}_web`,
                instanceName
            ];
            
            for (const pattern of patterns) {
                const { stdout } = await execPromise(`docker ps -a --filter "name=^${pattern}$" --format "{{.Names}}"`);
                const containerName = stdout.trim();
                if (containerName === pattern) {
                    return containerName;
                }
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Get the actual database container name for an instance
     * Handles both standard REDAXO instances (redaxo-{name}_db) and custom instances ({name}db)
     */
    async getDbContainerName(instanceName: string): Promise<string | null> {
        try {
            // Try standard REDAXO naming first
            const standardName = `redaxo-${instanceName}_db`;
            const { stdout: stdCheck } = await execPromise(`docker ps -a --filter "name=^${standardName}$" --format "{{.Names}}"`);
            if (stdCheck.trim() === standardName) {
                return standardName;
            }
            
            // Try alternative standard naming
            const altStandardName = `redaxo-${instanceName}-mysql`;
            const { stdout: altCheck } = await execPromise(`docker ps -a --filter "name=^${altStandardName}$" --format "{{.Names}}"`);
            if (altCheck.trim() === altStandardName) {
                return altStandardName;
            }
            
            // Try custom instance naming patterns
            const patterns = [
                `${instanceName}db`,
                `${instanceName}-db`,
                `${instanceName}_db`,
                `${instanceName}-mysql`,
                `${instanceName}_mysql`,
                `db_${instanceName}`
            ];
            
            for (const pattern of patterns) {
                const { stdout } = await execPromise(`docker ps -a --filter "name=^${pattern}$" --format "{{.Names}}"`);
                const containerName = stdout.trim();
                if (containerName === pattern) {
                    return containerName;
                }
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }
}
