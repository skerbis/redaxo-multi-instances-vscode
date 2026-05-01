import * as vscode from 'vscode';
import * as path from 'path';
import { RedaxoInstance } from '../types/redaxo';
import { ResourceMonitor, InstanceResources } from '../docker/resourceMonitor';
import { DockerService } from '../docker/dockerService';

// Union type for all tree view items
export type TreeViewItem = RedaxoInstanceItem | CategoryItem | InfoItem;

export class InstancesProvider implements vscode.TreeDataProvider<TreeViewItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeViewItem | undefined | null | void> = new vscode.EventEmitter<TreeViewItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeViewItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private instances: RedaxoInstance[] = [];
    private statusBarItem: vscode.StatusBarItem;
    private refreshTimer: NodeJS.Timeout | undefined;

    constructor(private dockerService: DockerService) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.command = 'redaxo-instances.refresh';
        this.statusBarItem.show();
        
        // Auto-refresh every 30 seconds to update resources
        this.refreshTimer = setInterval(() => {
            this.refresh();
        }, 30000);
    }

    async refresh(): Promise<void> {
        this.instances = await this.dockerService.listInstances();
        this.updateStatusBar();
        this._onDidChangeTreeData.fire();
    }

    refreshItem(item?: TreeViewItem): void {
        this._onDidChangeTreeData.fire(item);
    }

    private async loadInstances(): Promise<void> {
        try {
            this.instances = await this.dockerService.listInstances();
        } catch (error) {
            vscode.window.showErrorMessage(`Error loading instances: ${error}`);
            this.instances = [];
        }
    }

    private updateStatusBar(): void {
        const runningCount = this.instances.filter(i => i.running).length;
        const totalCount = this.instances.length;
        
        if (totalCount === 0) {
            this.statusBarItem.text = '$(server) No Instances';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else if (runningCount === 0) {
            this.statusBarItem.text = `$(server) ${totalCount} Stopped`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        } else {
            this.statusBarItem.text = `$(server) ${runningCount}/${totalCount} Running`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.activeBackground');
        }
    }

    getTreeItem(element: TreeViewItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeViewItem): Thenable<TreeViewItem[]> {
        if (!element) {
            // Return root: only category items (or info if empty)
            if (this.instances.length === 0) {
                return Promise.resolve([new InfoItem('No instances found', 'Click "Create Instance" to get started', 'info')]);
            }

            const runningInstances = this.instances.filter(i => i.running);
            const stoppedInstances = this.instances.filter(i => !i.running);

            const items: TreeViewItem[] = [];

            if (runningInstances.length > 0) {
                items.push(new CategoryItem('🟢 Running Instances', runningInstances.length, 'running'));
            }
            if (stoppedInstances.length > 0) {
                items.push(new CategoryItem('⚫ Stopped Instances', stoppedInstances.length, 'stopped'));
            }

            return Promise.resolve(items);
        }

        if (element instanceof CategoryItem) {
            const isRunning = element.categoryType === 'running';
            const filtered = this.instances.filter(i => i.running === isRunning);
            const contextPrefix = isRunning ? 'running-instance' : 'stopped-instance';
            return Promise.resolve(
                filtered.map(instance => new RedaxoInstanceItem(instance, this, contextPrefix))
            );
        }

        return Promise.resolve([]);
    }

    getParent?(element: TreeViewItem): vscode.ProviderResult<TreeViewItem> {
        if (element instanceof RedaxoInstanceItem) {
            const isRunning = element.instance.running;
            const label = isRunning ? '🟢 Running Instances' : '⚫ Stopped Instances';
            const count = this.instances.filter(i => i.running === isRunning).length;
            return new CategoryItem(label, count, isRunning ? 'running' : 'stopped');
        }
        return null;
    }

    getInstance(instanceName: string): RedaxoInstance | undefined {
        return this.instances.find(instance => instance.name === instanceName);
    }

    dispose(): void {
        this.statusBarItem.dispose();
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
    }
}

export class RedaxoInstanceItem extends vscode.TreeItem {
    public readonly instance: RedaxoInstance;
    private resources: InstanceResources | null = null;
    private provider?: InstancesProvider;

    constructor(instance: RedaxoInstance, provider?: InstancesProvider, contextPrefix?: string) {
        super(instance.name, vscode.TreeItemCollapsibleState.None);
        
        this.instance = instance;
        this.provider = provider;
        this.tooltip = this.generateTooltip(instance);
        this.description = this.generateDescription(instance);
        this.contextValue = contextPrefix || (instance.running ? 'instance-running' : 'instance-stopped');
        this.iconPath = this.getIconPath(instance);
        
        // Add command to show context menu on single click
        this.command = {
            command: 'redaxo-instances.showInstanceContextMenu',
            title: 'Show Instance Actions',
            arguments: [instance.name]
        };

        // Load resources asynchronously if instance is running
        if (instance.running) {
            this.loadResources();
        }
    }

    private async loadResources(): Promise<void> {
        try {
            const instanceType = this.instance.instanceType === 'custom' ? 'custom' : 'redaxo';
            this.resources = await ResourceMonitor.getInstanceResources(this.instance.name, instanceType);
            
            // Update tooltip and description with resource info
            this.tooltip = this.generateTooltip(this.instance);
            this.description = this.generateDescription(this.instance);
            
            // Trigger TreeView refresh
            if (this.provider) {
                this.provider.refreshItem(this);
            }
        } catch (error) {
            console.error(`Error loading resources for ${this.instance.name}:`, error);
        }
    }

    private generateTooltip(instance: RedaxoInstance): string {
        const status = instance.running ? 'Running' : 'Stopped';
        const typeLabel = instance.instanceType === 'custom' ? 'Custom Instance' : 'REDAXO Instance';
        let tooltip = `${instance.name}\nType: ${typeLabel}\nStatus: ${status}\nPHP: ${instance.phpVersion}\nMariaDB: ${instance.mariadbVersion}`;
        
        // Add port information
        if (instance.httpPort) {
            tooltip += `\nHTTP Port: ${instance.httpPort}`;
        }
        
        if (instance.httpsPort) {
            tooltip += `\nHTTPS Port: ${instance.httpsPort}`;
        }
        
        if (instance.frontendUrl) {
            tooltip += `\nHTTP: ${instance.frontendUrl}`;
        }

        if (instance.backendUrl) {
            tooltip += `\nAdmin: ${instance.backendUrl}`;
        }// Add resource information if available
        if (this.resources && instance.running) {
            tooltip += '\n\n📊 Resources:';
            if (this.resources.total) {
                tooltip += `\n  CPU: ${this.resources.total.cpu}`;
                tooltip += `\n  Memory: ${this.resources.total.memory}`;
            }
            if (this.resources.web) {
                tooltip += `\n  Web: ${this.resources.web.memoryUsage}`;
            }
            if (this.resources.db) {
                tooltip += `\n  DB: ${this.resources.db.memoryUsage}`;
            }
        }
        
        if (instance.running) {
            tooltip += '\n\nDouble-click to open in browser';
        }
        
        return tooltip;
    }

    private generateDescription(instance: RedaxoInstance): string {
        const status = instance.running ? '●' : '○';
        const typeLabel = instance.instanceType === 'custom' ? 'Custom' : 'REDAXO';
        let description = `${status} ${typeLabel} | PHP ${instance.phpVersion} | MariaDB ${instance.mariadbVersion}`;
        
        if (instance.port) {
            description += ` | HTTP:${instance.port}`;
        }
        
        // Add HTTPS port if SSL is configured
        if (instance.frontendUrlHttps) {
            const httpsUrl = new URL(instance.frontendUrlHttps);
            const httpsPort = httpsUrl.port || '443';
            description += ` | HTTPS:${httpsPort}`;
        }

        // Add compact resource info if available and running
        if (this.resources && instance.running && this.resources.total) {
            description += ` | 📊 ${this.resources.total.cpu} CPU, ${this.resources.total.memory} RAM`;
        }
        
        return description;
    }

    private getIconPath(instance: RedaxoInstance): vscode.ThemeIcon {
        if (instance.status === 'creating') {
            return new vscode.ThemeIcon('loading~spin');
        }
        
        // Use different icons for different instance types
        const iconName = instance.instanceType === 'custom' ? 'package' : 'server-environment';
        
        if (instance.running) {
            return new vscode.ThemeIcon(iconName, new vscode.ThemeColor('charts.green'));
        }
        
        if (instance.status === 'error') {
            return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
        }
        
        return new vscode.ThemeIcon(iconName, new vscode.ThemeColor('charts.yellow'));
    }
}

export class CategoryItem extends vscode.TreeItem {
    public readonly categoryType: 'running' | 'stopped';

    constructor(label: string, count: number, categoryType: 'running' | 'stopped') {
        super(`${label} (${count})`, vscode.TreeItemCollapsibleState.Expanded);

        this.categoryType = categoryType;
        this.contextValue = 'category';
        this.iconPath = new vscode.ThemeIcon('folder');
        this.tooltip = `${count} instances in this category`;
        this.command = undefined;
    }
}

export class InfoItem extends vscode.TreeItem {
    constructor(label: string, description: string, type: 'info' | 'warning' | 'error') {
        super(label, vscode.TreeItemCollapsibleState.None);
        
        this.description = description;
        this.contextValue = 'info';
        this.tooltip = description;
        
        switch (type) {
            case 'warning':
                this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
                break;
            case 'error':
                this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
                break;
            default:
                this.iconPath = new vscode.ThemeIcon('info', new vscode.ThemeColor('charts.blue'));
        }
    }
}
