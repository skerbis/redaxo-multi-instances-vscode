import * as vscode from 'vscode';
import { EmptyInstanceService, EmptyInstanceConfig } from './emptyInstanceService';
import { DockerService } from '../docker/dockerService';
import * as path from 'path';

export class EmptyInstanceProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'redaxoEmptyInstance';
    private _view?: vscode.WebviewView;
    private emptyInstanceService: EmptyInstanceService;
    private dockerService: DockerService;

    constructor(private readonly _extensionUri: vscode.Uri, dockerService: DockerService) {
        this.emptyInstanceService = new EmptyInstanceService();
        this.dockerService = dockerService;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'createEmptyInstance':
                    this.handleCreateEmptyInstance(data.config);
                    break;
            }
        });
    }

    private async handleCreateEmptyInstance(config: any) {
        try {
            // Instances-Ordner vom DockerService verwenden
            const instancesPath = await this.dockerService.getInstancesDirectory();
            const projectPath = path.join(instancesPath, config.instanceName);

            const emptyConfig: EmptyInstanceConfig = {
                instanceName: config.instanceName,
                projectPath: projectPath,
                phpVersion: config.phpVersion,
                mariadbVersion: config.mariadbVersion,
                enableXdebug: config.enableXdebug,
                createWelcome: config.createWelcome
            };
            this.emptyInstanceService['outputChannel']?.appendLine?.(`[DEBUG] Provider: createWelcome=${config.createWelcome}`);

            await this.emptyInstanceService.createEmptyInstance(emptyConfig);
            
            // Ordner in VS Code öffnen
            if (config.openInNewWindow) {
                const uri = vscode.Uri.file(projectPath);
                await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
            }
            
            // Success-Nachricht an Webview senden
            if (this._view) {
                this._view.webview.postMessage({ 
                    type: 'creationSuccess',
                    path: projectPath 
                });
            }
            
        } catch (error) {
            vscode.window.showErrorMessage(`Fehler beim Erstellen der Custom Instance: ${error}`);
            
            // Error-Nachricht an Webview senden
            if (this._view) {
                this._view.webview.postMessage({ 
                    type: 'creationError', 
                    error: error?.toString() 
                });
            }
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="de">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Custom Instance</title>
            <style>
                * {
                    box-sizing: border-box;
                }
                
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 0;
                    line-height: 1.4;
                }
                
                .container {
                    padding: 16px;
                    max-width: 100%;
                }
                
                .header {
                    margin-bottom: 20px;
                    padding-bottom: 16px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                
                .header h2 {
                    margin: 0 0 8px 0;
                    color: var(--vscode-foreground);
                    font-size: 18px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .header p {
                    margin: 0;
                    color: var(--vscode-descriptionForeground);
                    font-size: 13px;
                }
                
                .form-group {
                    margin-bottom: 16px;
                }
                
                .form-group label {
                    display: block;
                    margin-bottom: 6px;
                    color: var(--vscode-foreground);
                    font-weight: 500;
                    font-size: 13px;
                }
                
                .form-group small {
                    display: block;
                    margin-top: 4px;
                    color: var(--vscode-descriptionForeground);
                    font-size: 11px;
                    line-height: 1.3;
                }
                
                .form-group input,
                .form-group select {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border-radius: 4px;
                    font-family: var(--vscode-font-family);
                    font-size: 13px;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                
                .form-group input:focus,
                .form-group select:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                    box-shadow: 0 0 0 1px var(--vscode-focusBorder);
                }
                
                .form-group input:disabled {
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-disabledForeground);
                    cursor: not-allowed;
                    opacity: 0.6;
                }
                
                .path-input {
                    display: flex;
                    gap: 8px;
                    align-items: stretch;
                }
                
                .path-input input {
                    flex: 1;
                }
                
                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                
                .checkbox-group {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    margin-top: 6px;
                }
                
                .checkbox-group input[type="checkbox"] {
                    width: auto;
                    margin: 0;
                    margin-top: 2px;
                    flex-shrink: 0;
                    accent-color: var(--vscode-checkbox-background);
                }
                
                .checkbox-group label {
                    margin: 0;
                    font-weight: 400;
                    cursor: pointer;
                    line-height: 1.4;
                }
                
                .btn-primary,
                .btn-secondary {
                    padding: 10px 16px;
                    border: 1px solid transparent;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: var(--vscode-font-family);
                    font-size: 13px;
                    font-weight: 500;
                    text-align: center;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }
                
                .btn-primary {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    width: 100%;
                    padding: 14px 16px;
                    font-size: 14px;
                    font-weight: 600;
                    margin-top: 8px;
                }
                
                .btn-primary:hover:not(:disabled) {
                    background-color: var(--vscode-button-hoverBackground);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                }
                
                .btn-primary:disabled {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }
                
                .btn-secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border-color: var(--vscode-button-border, var(--vscode-input-border));
                    flex-shrink: 0;
                }
                
                .btn-secondary:hover:not(:disabled) {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                    transform: translateY(-1px);
                }
                
                .info-section {
                    margin-top: 24px;
                    padding: 16px;
                    background-color: var(--vscode-editorWidget-background);
                    border: 1px solid var(--vscode-widget-border);
                    border-radius: 6px;
                    border-left: 4px solid var(--vscode-textBlockQuote-border);
                }
                
                .info-section h3 {
                    margin: 0 0 12px 0;
                    color: var(--vscode-foreground);
                    font-size: 14px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                
                .info-section ul {
                    margin: 8px 0 0 0;
                    padding-left: 20px;
                    color: var(--vscode-foreground);
                }
                
                .info-section li {
                    margin-bottom: 6px;
                    font-size: 12px;
                    line-height: 1.5;
                }
                
                .info-section li strong {
                    color: var(--vscode-textPreformat-foreground);
                    font-weight: 600;
                }
                
                .features-list {
                    display: grid;
                    gap: 12px;
                    margin-top: 12px;
                }
                
                .feature {
                    padding: 12px;
                    background-color: var(--vscode-textBlockQuote-background);
                    border-left: 3px solid var(--vscode-textBlockQuote-border);
                    border-radius: 0 4px 4px 0;
                }
                
                .feature strong {
                    display: block;
                    color: var(--vscode-foreground);
                    font-size: 13px;
                    font-weight: 600;
                    margin-bottom: 4px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                
                .feature p {
                    margin: 0;
                    color: var(--vscode-descriptionForeground);
                    font-size: 12px;
                    line-height: 1.4;
                }
                
                .status-message {
                    padding: 12px 16px;
                    border-radius: 6px;
                    margin-top: 16px;
                    font-size: 13px;
                    font-weight: 500;
                    display: none;
                    border-left: 4px solid;
                }
                
                .status-message.success {
                    background-color: var(--vscode-testing-iconPassed);
                    color: var(--vscode-editor-background);
                    border-left-color: var(--vscode-editor-background);
                }
                
                .status-message.error {
                    background-color: var(--vscode-testing-iconFailed);
                    color: var(--vscode-editor-background);
                    border-left-color: var(--vscode-editor-background);
                }
                
                .status-message.info {
                    background-color: var(--vscode-testing-iconQueued);
                    color: var(--vscode-editor-background);
                    border-left-color: var(--vscode-editor-background);
                }
                
                .field-error {
                    color: var(--vscode-testing-iconFailed);
                    font-size: 11px;
                    margin-top: 4px;
                    display: block;
                }
                
                .form-group input.error,
                .form-group select.error {
                    border-color: var(--vscode-testing-iconFailed);
                    box-shadow: 0 0 0 1px var(--vscode-testing-iconFailed);
                }
                
                .loading {
                    opacity: 0.7;
                    pointer-events: none;
                    position: relative;
                }
                
                .loading::after {
                    content: '';
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 20px;
                    height: 20px;
                    margin: -10px 0 0 -10px;
                    border: 2px solid var(--vscode-progressBar-background);
                    border-top: 2px solid var(--vscode-button-background);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                @media (max-width: 400px) {
                    .container {
                        padding: 12px;
                    }
                    
                    .form-row {
                        grid-template-columns: 1fr;
                    }
                    
                    .path-input {
                        flex-direction: column;
                        gap: 8px;
                    }
                    
                    .features-list {
                        grid-template-columns: 1fr;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>📦 Custom Instance</h2>
                    <p>Erstelle eine leere PHP-Instanz mit public/ Ordner</p>
                </div>

                <form id="emptyInstanceForm">
                    <div class="form-group">
                        <label for="instanceName">Instanz Name:</label>
                        <input type="text" id="instanceName" placeholder="z.B. my-project" required>
                        <small>Wird im REDAXO Instances-Ordner erstellt</small>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="phpVersion">PHP Version:</label>
                            <select id="phpVersion" required>
                                    <option value="8.5">PHP 8.5 (Neueste)</option>
                                    <option value="8.4">PHP 8.4</option>
                                    <option value="8.3">PHP 8.3</option>
                                    <option value="8.2">PHP 8.2</option>
                                    <option value="8.1">PHP 8.1</option>
                                    <option value="7.4">PHP 7.4 (Letzte 7.x)</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="mariadbVersion">MariaDB Version:</label>
                            <select id="mariadbVersion" required>
                                <option value="12.2">MariaDB 12.2 (Rolling - Neueste Features)</option>
                                <option value="11.8">MariaDB 11.8 (LTS - Empfohlen)</option>
                                <option value="11.4">MariaDB 11.4 (LTS - Stabil)</option>
                                <option value="10.11">MariaDB 10.11 (LTS - Legacy)</option>
                                <option value="10.6">MariaDB 10.6 (LTS - Legacy)</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group checkbox-group">
                        <input type="checkbox" id="createWelcome" name="createWelcome" checked>
                        <label for="createWelcome">Willkommensseite (index.php) anlegen</label>
                    </div>
                    
                    <div class="form-group checkbox-group">
                        <input type="checkbox" id="enableXdebug" name="enableXdebug">
                        <label for="enableXdebug">Xdebug aktivieren (für Debugging)</label>
                    </div>
                    
                    <div class="form-group checkbox-group">
                        <input type="checkbox" id="enableSSL" name="enableSSL" checked>
                        <label for="enableSSL">🔒 SSL automatisch einrichten (HTTPS)</label>
                        <small>Erstellt Zertifikate und konfiguriert Apache für HTTPS</small>
                    </div>
                    
                    <div class="form-group checkbox-group">
                        <input type="checkbox" id="openInNewWindow" name="openInNewWindow" checked>
                        <label for="openInNewWindow">In neuem Fenster öffnen</label>
                    </div>
                    <button type="submit" class="btn-primary" id="createBtn">
                        🚀 Custom Instance erstellen
                    </button>
                </form>

                <div class="info-section">
                    <h3>📋 Was wird erstellt?</h3>
                    <div class="features-list">
                        <div class="feature">
                            <strong>🐳 Docker Setup</strong>
                            <p>Optimierte Container mit Apache, PHP, MariaDB</p>
                        </div>
                        <div class="feature">
                            <strong>📁 Public Ordner</strong>
                            <p>Webroot mit Welcome-Seite und phpinfo()</p>
                        </div>
                        <div class="feature">
                            <strong>🔧 Extensions</strong>
                            <p>ImageMagick, Intl, ffmpeg, optional Xdebug</p>
                        </div>
                        <div class="feature">
                            <strong>⚡ Performance</strong>
                            <p>2GB RAM, 512MB Upload, 300s Execution Time</p>
                        </div>
                        <div class="feature">
                            <strong>🔒 HTTPS Ready</strong>
                            <p>Selbstsignierte SSL-Zertifikate inklusive</p>
                        </div>
                        <div class="feature">
                            <strong>🎯 Automatische Ports</strong>
                            <p>Freie HTTP/HTTPS/DB Ports werden automatisch gefunden</p>
                        </div>
                    </div>
                </div>

                <div class="info-section">
                    <h3>🎯 Perfekt für:</h3>
                    <ul>
                        <li><strong>REDAXO Projekte</strong> - Installiere REDAXO direkt in public/</li>
                        <li><strong>Symfony/Laravel</strong> - Public-Ordner ist bereits konfiguriert</li>
                        <li><strong>WordPress</strong> - Einfach in public/ entpacken</li>
                        <li><strong>Custom PHP Apps</strong> - Eigene Anwendungen entwickeln</li>
                        <li><strong>Prototyping</strong> - Schnell mal was ausprobieren</li>
                    </ul>
                </div>
            </div>

            <script>
                (function() {
                    const vscode = acquireVsCodeApi();
                    
                    // DOM Elements
                    const form = document.getElementById('emptyInstanceForm');
                    const instanceNameInput = document.getElementById('instanceName');
                    const phpVersionSelect = document.getElementById('phpVersion');
                    const mariadbVersionSelect = document.getElementById('mariadbVersion');
                    const createWelcomeCheckbox = document.getElementById('createWelcome');
                    const xdebugCheckbox = document.getElementById('enableXdebug');
                    const enableSSLCheckbox = document.getElementById('enableSSL');
                    const openInNewWindowCheckbox = document.getElementById('openInNewWindow');
                    const createBtn = document.getElementById('createBtn');
                    
                    // Event Listeners
                    form.addEventListener('submit', (e) => {
                        e.preventDefault();
                        
                        if (!validateForm()) {
                            return;
                        }
                        
                        const config = {
                            instanceName: instanceNameInput.value.trim(),
                            phpVersion: phpVersionSelect.value,
                            mariadbVersion: mariadbVersionSelect.value,
                            createWelcome: createWelcomeCheckbox.checked,
                            enableXdebug: xdebugCheckbox.checked,
                            enableSSL: enableSSLCheckbox.checked,
                            openInNewWindow: openInNewWindowCheckbox.checked
                        };
                        console.log('[EmptyInstance Webview] Sende Config', config);
                        
                        setFormLoading(true);
                        
                        vscode.postMessage({
                            type: 'createEmptyInstance',
                            config: config
                        });
                    });
                    
                    // Instance name validation
                    instanceNameInput.addEventListener('input', (e) => {
                        let value = e.target.value;
                        value = value.replace(/[^a-zA-Z0-9-_]/g, '');
                        value = value.toLowerCase();
                        value = value.replace(/[-_]{2,}/g, match => match[0]);
                        
                        if (value.length > 0) {
                            value = value.replace(/^[-_]+/, '');
                            value = value.replace(/[-_]+$/, '');
                        }
                        
                        e.target.value = value;
                        validateInstanceName();
                    });
                    
                    // Message handling
                    window.addEventListener('message', event => {
                        const message = event.data;
                        
                        switch (message.type) {
                            case 'creationSuccess':
                                showStatus('success', '✅ Custom Instance erfolgreich erstellt!');
                                setFormLoading(false);
                                resetForm();
                                break;
                                
                            case 'creationError':
                                showStatus('error', '❌ Fehler: ' + (message.error || 'Unbekannter Fehler'));
                                setFormLoading(false);
                                break;
                        }
                    });
                    
                    // Validation Functions
                    function validateForm() {
                        return validateInstanceName();
                    }
                    
                    function validateInstanceName() {
                        const value = instanceNameInput.value.trim();
                        
                        if (!value) {
                            showFieldError(instanceNameInput, 'Instanz Name ist erforderlich');
                            return false;
                        }
                        
                        if (value.length < 2) {
                            showFieldError(instanceNameInput, 'Mindestens 2 Zeichen erforderlich');
                            return false;
                        }
                        
                        if (value.length > 50) {
                            showFieldError(instanceNameInput, 'Maximal 50 Zeichen erlaubt');
                            return false;
                        }
                        
                        if (!/^[a-z0-9]([a-z0-9-_]*[a-z0-9])?$/.test(value)) {
                            showFieldError(instanceNameInput, 'Nur Buchstaben, Zahlen, - und _');
                            return false;
                        }
                        
                        clearFieldError(instanceNameInput);
                        return true;
                    }
                    
                    function showFieldError(field, message) {
                        clearFieldError(field);
                        field.classList.add('error');
                        
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'field-error';
                        errorDiv.textContent = message;
                        field.parentNode.appendChild(errorDiv);
                    }
                    
                    function clearFieldError(field) {
                        field.classList.remove('error');
                        const errorDiv = field.parentNode.querySelector('.field-error');
                        if (errorDiv) {
                            errorDiv.remove();
                        }
                    }
                    
                    function setFormLoading(loading) {
                        createBtn.disabled = loading;
                        
                        if (loading) {
                            createBtn.textContent = '🔄 Erstelle Custom Instance...';
                            form.classList.add('loading');
                        } else {
                            createBtn.textContent = '🚀 Custom Instance erstellen';
                            form.classList.remove('loading');
                        }
                    }
                    
                    function showStatus(type, message) {
                        const existingStatus = document.querySelector('.status-message');
                        if (existingStatus) {
                            existingStatus.remove();
                        }
                        
                        const statusDiv = document.createElement('div');
                        statusDiv.className = \`status-message \${type}\`;
                        statusDiv.textContent = message;
                        statusDiv.style.display = 'block';
                        
                        form.parentNode.insertBefore(statusDiv, form.nextSibling);
                        
                        if (type === 'success') {
                            setTimeout(() => {
                                if (statusDiv.parentNode) {
                                    statusDiv.remove();
                                }
                            }, 5000);
                        }
                    }
                    
                    function resetForm() {
                        form.reset();
                        instanceNameInput.value = '';
                        
                        document.querySelectorAll('.error').forEach(field => {
                            clearFieldError(field);
                        });
                        
                        phpVersionSelect.value = '8.3';
                        mariadbVersionSelect.value = '11.2';
                        xdebugCheckbox.checked = false;
                        openInNewWindowCheckbox.checked = true;
                    }
                    
                    // Initialize
                    phpVersionSelect.value = '8.3';
                    mariadbVersionSelect.value = '11.2';
                    openInNewWindowCheckbox.checked = true;
                })();
            </script>
        </body>
        </html>`;
    }
}
