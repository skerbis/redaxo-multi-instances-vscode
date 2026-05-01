# Changelog

## Version 1.21.0 (2026-04-30)

### ✨ New Features
- **Instance Transfer**: Export/Import kompletter Instanzen als `.tar.gz`-Bundle mit Manifest, Konfiguration und optionalem DB-Dump.
- **Maintenance Menü**: Port-Reorganisation, Restart laufender Instanzen und Prune verwaister Docker-Ressourcen.
- **MariaDB Version Switch**: Versionswechsel pro Instanz inklusive Anpassung von `.env` und `docker-compose.yml`.

### 🔧 Improvements
- **TreeView Hierarchie**: Running/Stopped als echte, aufklappbare Kategorien statt flacher Liste.
- **PHP Defaults**: `8.5` als Default-Version in den Settings ergänzt.
- **Dependency Refresh**: Non-breaking Updates der Dev-Dependencies für aktuellen Build-Stand.

### 📝 Notes
- Verbleibende `npm audit`-Findings liegen primär in der Test-Toolchain und werden separat über Major-Upgrades adressiert.

## Version 1.11.4 (2026-03-23)

### 🐛 Bug Fixes
- **Login Info Anzeige**: REDAXO Backend-Zugangsdaten (Username/Passwort) wurden im Login Info Dashboard nicht angezeigt (veralteter Build)
- **Build-Prozess**: Extension korrekt neu kompiliert und paketiert – `dist/extension.js` war veraltet

### 🔧 Technical
- Neu kompiliert mit webpack 5.105.0
- VSIX-Package aktualisiert auf aktuellen Stand des Quellcodes

---

## Version 1.11.3 (2026-02-09)

### ✨ New Features
- **💾 Create Additional Databases**: Neue Funktion zum Erstellen zusätzlicher Datenbanken in einer Instanz
  - Verfügbar über Kontext-Menü bei laufenden Instanzen
  - Automatische GRANT ALL PRIVILEGES für den Standard-User
  - Sofortige Sichtbarkeit in Adminer nach Neu-Login
  - Validierung von Datenbanknamen (nur alphanumerische Zeichen und Unterstriche)
  - Standard: utf8mb4_unicode_ci Collation

### 🐛 Bug Fixes
- **MariaDB Client Detection**: Automatische Erkennung von `mariadb` vs `mysql` Client in DB-Containern
- **SQL Escaping**: Verbesserte Shell-Escaping für Datenbanknamen und Credentials
- **Separate Commands**: Verwendet 3 separate SQL-Befehle für höhere Zuverlässigkeit
  - CREATE DATABASE (kritisch)
  - GRANT PRIVILEGES (graceful fallback)
  - FLUSH PRIVILEGES (graceful fallback)

### 🔧 Technical Improvements
- DatabaseQueryService erweitert um `createDatabase()` und `listDatabases()` Methoden
- Robuste Command-Ausführung mit fehlertoleranten non-critical Operationen
- Bessere Integration mit Adminer für Multi-Database-Support

### 📝 Documentation
- README erweitert um Multi-Database Support Sektion
- Detaillierte Verwendungsanleitung und Anwendungsfälle
- Release Notes mit allen Bugfixes dokumentiert

---

## Version 1.11.2 (2026-02-09)

### 🐛 Bug Fixes
- SQL Escaping Fix: Verbesserte Shell-Escaping für Datenbanknamen in CREATE DATABASE Queries
- Password Handling: Passwort wird in Quotes übergeben für bessere Kompatibilität

---

## Version 1.11.1 (2026-02-09)

### 🐛 Bug Fixes
- MariaDB Client Detection Fix: Automatische Erkennung von `mariadb` vs `mysql` Client
- Fix für "mysql: not found" Fehler bei MariaDB 11.x Containern

---

## Version 1.11.0 (2026-02-09)

### ✨ New Features
- **Create Additional Databases**: Neue Funktion zum Erstellen zusätzlicher Datenbanken
- Zeigt existierende Datenbanken an
- Validierung von Datenbanknamen
- Direkter Adminer-Link nach Erstellung

### 🔧 Improvements
- DatabaseQueryService um Database-Management erweitert
- QuickPick-Menü um Database-Creation erweitert

---

## Version 1.10.1 (2026-02-08)

### 📦 Dependency Updates
- Updated all development dependencies to latest versions
- @types/node: 22.x → 25.2.2
- @types/vscode: 1.103.0 → 1.109.0
- @typescript-eslint/eslint-plugin: 8.39.0 → 8.54.0
- @typescript-eslint/parser: 8.39.0 → 8.54.0
- eslint: 9.32.0 → 9.39.2
- ts-loader: 9.5.2 → 9.5.4
- typescript: 5.9.2 → 5.9.3
- webpack: 5.101.0 → 5.105.0
- mocha: added at 11.7.5

### 🔧 Maintenance
- Improved build configuration
- Enhanced compatibility with latest VS Code versions



## [1.10.0] - 2025-11-22

### Changed
- 🧹 **DB import/export removed from extension**: Direct export/import methods were removed from the extension codebase and UI. Use the global Adminer UI (Open in Adminer / Start Adminer) or external tools for database dump workflows.
- 🔒 **Safer default**: Avoid running dumps/imports from the extension to reduce accidental destructive imports; Adminer provides a safer interactive experience with pre-filled credentials.
- 🧪 **Tests updated**: Unit tests referencing export/import adjusted or removed where relevant.

### Notes
- This release simplifies maintenance and improves reliability by delegating DB dump responsibilities to Adminer which already ships with upload/size limits and a container lifecycle.

## [1.9.0] - 2025-11-21

### Added
- 🎯 **Custom Instance Full Support**: Vollständige Unterstützung für Custom REDAXO Instanzen mit individuellen Verzeichnisstrukturen
- 🔍 **Smart Path Detection**: Automatische Erkennung von REDAXO Verzeichnisstrukturen (Standard, Custom mit public/, Root-Level)
- 🚀 **Dynamic Console Path Resolution**: Intelligente Erkennung des REDAXO Console-Pfads (`/var/www/html/bin/console` oder `/var/www/html/redaxo/bin/console`)
- 📁 **Flexible FileSystem Service**: Unterstützt alle REDAXO-Pfadstrukturen (redaxo/, public/redaxo/, root-level)
- ⚡ **Performance Caching**: Path-Detection wird gecacht für schnellere wiederholte Zugriffe
- 🔧 **Enhanced Chat Participant**: Alle @redaxo Commands funktionieren jetzt mit Custom Instances

### Fixed
- ✅ `/addons` Command funktioniert jetzt mit Custom Instances (z.B. welling)
- ✅ `/console` Command erkennt korrekte Console-Pfade automatisch
- ✅ `/config` und `/logs` Commands unterstützen verschiedene Verzeichnisstrukturen
- ✅ Container-Namens-Auflösung für Custom Instances (wellingweb, coredb statt redaxo-welling)

### Technical
- `RedaxoConsoleService.getConsolePath()`: Prüft `/var/www/html/bin/console` vor Standard-Pfad
- `FileSystemService.detectRedaxoBasePath()`: Erkennt 3 Strukturen (root-level mit /data/core/ Check, redaxo/, public/redaxo/)
- Cache-Maps für Console-Pfade und Base-Pfade zur Performance-Optimierung
- Robustere Fehlerbehandlung mit try-catch pro Pfad-Check
- Alle convenience methods (readConfig, listAddons, readLog, etc.) verwenden dynamische Pfaderkennung

### Improved
- 📊 Bessere Fehlerbehandlung wenn Container nicht gefunden werden
- 🎨 Konsistente Error-Returns mit korrekten Typen (FileReadResult, FileListResult, FileInfo[], boolean)
- 🔄 Helper-Methoden für Container-Namen-Auflösung in allen Services
- 📝 Service-Initialisierung mit DockerService für zentrale Container-Verwaltung

---

## [1.8.2] - 2025-11-21

### Added
- 🗄️ **Adminer Database Management**: Globaler Adminer-Container für Datenbankverwaltung aller Instanzen
- 🔗 **One-Click Database Access**: Rechtsklick auf laufende Instanz → "Open in Adminer" öffnet Browser mit vorausgefüllten Credentials
- 📋 **Clipboard Integration**: Passwort wird automatisch in Zwischenablage kopiert für schnellen Login
- 🐳 **Docker Network Integration**: Automatische Verbindung der DB-Container zum Adminer-Netzwerk
- 📊 **Large File Support**: PHP konfiguriert für 512MB Uploads (Dump-Import/Export)
- 🔧 **Context Menu Commands**: "Show REDAXO Logs" und "Install CLI Tools" direkt im Kontextmenü
- 🌐 **Port 9200**: Adminer läuft auf dediziertem Port 9200
- 🎯 **Custom Instance Support**: Intelligente Container-Namens-Auflösung für Custom und Standard REDAXO Instanzen

### Technical
- Neue `AdminerService`: Lifecycle-Management für globalen Adminer-Container
- `adminer:latest` Image mit custom PHP-Konfiguration (upload_max_filesize, post_max_size, memory_limit: 512M)
- Automatische Netzwerk-Erstellung (`redaxo-adminer-network`) für Container-zu-Container Kommunikation
- DNS-konforme Hostname-Auflösung für Custom-Instanzen (entfernt Unterstriche)
- Adminer URL-Parameter: `?username=X&db=Y&server=Z` für Pre-Fill
- Context Menu: `showRedaxoLogs`, `installCLITools`, `openInAdminer` Commands
- FileSystemService Integration für REDAXO Log-Dateien (redaxo.log, system.log)

---

## [1.8.1] - 2025-11-21

### Improved
- 🔍 **MariaDB/MySQL Tool-Erkennung**: `/install-tools` erkennt jetzt automatisch MariaDB vs MySQL Container
- 🛠️ **Native Database Tools**: Verwendet `mariadb`/`mariadb-dump` für MariaDB-Images und `mysql`/`mysqldump` für MySQL-Images
- 📦 **Intelligente Installation**: Prüft auf vorhandene Tools vor Installation und vermeidet redundante Operationen
- 📊 **Präzise Reporting**: Zeigt tatsächlich installierte/gefundene Tool-Namen an statt generischer Bezeichnungen

### Technical
- `DatabaseQueryService.ensureMysqlClient()`: Erkennt MariaDB und MySQL native Clients
- `redaxoChatParticipant.installDbContainerTools()`: Unterstützt beide Datenbanksysteme mit korrekter Tool-Erkennung
- Verbesserte Fallback-Logik für verschiedene Package Manager (apt-get, apk, yum)

---

## [1.8.0] - 2025-01-21

### Added
- 🤖 **GitHub Copilot Chat Integration**: Neuer Chat Participant `@redaxo` für direkte Instanz-Verwaltung aus Copilot Chat
- ⚡ **10 Slash Commands**: `/create`, `/start`, `/stop`, `/console`, `/query`, `/articles`, `/addons`, `/config`, `/logs`, `/install-tools`
- 🛠️ **CLI Tools Installation**: `/install-tools` Command installiert automatisch vim, nano, curl, wget, unzip, git, mysql, mysqldump
- 🔧 **REDAXO Console Service**: Direkte Ausführung von REDAXO Console Commands via Docker exec
- 🗄️ **Database Query Service**: MySQL-Queries direkt auf REDAXO-Datenbank ausführen mit automatischer MySQL Client Installation
- 📁 **FileSystem Service**: Dateien in REDAXO-Containern lesen/schreiben
- 🔍 **Dynamische Container-Erkennung**: Unterstützung für Standard (`redaxo-name`) und Custom (`nameweb`) Container-Namen
- 📖 **Erweiterte Dokumentation**: README und Hilfe-Webview um Copilot Chat Features erweitert

### Technical
- Neue Services: `RedaxoConsoleService`, `DatabaseQueryService`, `FileSystemService`
- Chat Participant Handler mit 9 Command-Handlern
- Follow-up Provider für Chat-Vorschläge
- Package.json: ChatParticipants Contribution Point
- Dokumentation: `COMMUNICATION_SERVICES.md` für Service-APIs

---

## [1.7.1] - 2025-08-30

### Fixed
- **Admin Password Authentication**: REDAXO admin password now shows actual password from .env file instead of hardcoded 'admin'
- **Login Info UI**: Fixed copy and visibility toggle buttons for admin password functionality
- **Password Display**: Corrected password extraction from MYSQL_PASSWORD environment variable
- **JavaScript Interactions**: Fixed selectors for password field visibility toggles and clipboard operations

### Improved
- Enhanced password field handling in login info webview
- Better error handling for password extraction from Docker environments

---

## [1.7.0] - 2025-08-29

### Changed
- Removed Modern Login Info preview from context menu
- Maintained clickable URLs functionality in login info
- Streamlined context menu by removing demo/preview entries

### Fixed
- Improved user interface consistency
- Cleaned up unnecessary context menu entries

---

## [1.6.5] - 2025-08-29

### 🎯 Smart User Interface
- **Context-Aware Display**: REDAXO Backend Login only shown for standard REDAXO instances
- **Custom Instance Clarity**: Password hints clearly indicate "Password = Instance Name" for custom instances
- **Intelligent UI**: Interface adapts based on instance type (custom vs standard REDAXO)

### 🗄️ MariaDB Version Updates
- **Updated Options**: MariaDB 11.6 (LTS), 11.5, 11.4, 11.3, 11.2, 10.11 available
- **Modern Database**: Latest MariaDB versions for improved performance and security
- **Multiple Choices**: Users can select appropriate MariaDB version for their needs

### 🔧 DNS-Compliant Containers
- **Container Names**: All new custom instances use DNS-compliant names without underscores
- **Improved Compatibility**: Better network connectivity and hostname resolution
- **Automatic Generation**: Helper functions ensure consistent naming for all new instances

### 🏆 Enhanced Custom Instance Management
- **Smart Detection**: Improved recognition of custom vs standard REDAXO instances
- **Backward Compatibility**: Supports both old (instance_web) and new (instanceweb) naming conventions
- **Clear Communication**: Users understand password conventions for custom instances

## [1.6.4] - 2025-08-29

### 🔧 Bug Fixes
- **Database Port Mapping**: Fixed external port display to show correct mapped ports from docker-compose.yml
- **Root Credentials**: Added root database credentials to External Access tab
- **Variable Consistency**: Fixed template variable mapping between dockerService and webview rendering

### 🏆 Technical Improvements
- **Correct Property Names**: Fixed `dbExternalPort`/`dbExternalHost` vs `dbPortExternal`/`dbHostExternal` mismatch
- **Port Extraction**: MySQL ports correctly extracted from docker-compose.yml port mappings
- **Database Info Display**: Proper differentiation between internal (3306) and external (mapped) ports

## [1.6.3] - 2025-08-29

### 🔧 Critical Bug Fixes
- **Database Port Mapping**: External DB ports correctly extracted from docker-compose.yml  
- **Root Credentials Display**: Root credentials available in both Container-Internal and External Access tabs
- **Variable Name Consistency**: Fixed variable mapping between dockerService and extension

## [1.6.2] - 2025-08-28

### 🔧 Critical Fixes
- **Hosts File Management**: Behebung von Duplikaten in /etc/hosts durch exakte Pattern-Matching
- **SSL_ERROR_RX_RECORD_TOO_LONG Fix**: Vollständige HTTP-zu-HTTPS Redirect-Implementierung verhindert Mixed-Protocol Fehler
- **Improved Host Detection**: Präzise `grep` Pattern vermeiden False-Positives bei ähnlichen Hostnamen (z.B. 'hhhh.local' vs 'hhhhhhh.local')

### ✨ New Features  
- **Hosts File Manager**: Neue `Manage Hosts File` Funktion mit drei Optionen:
  - **Show Hosts File**: Zeigt alle .local Einträge in der hosts-Datei
  - **Clean Duplicates**: Entfernt automatisch doppelte Einträge
  - **Reset Local Entries**: Komplettes Reset aller .local Einträge
- **Enhanced SSL Configuration**: Verbesserte Apache SSL-Konfiguration mit automatischen HTTP-Redirects
- **Duplicate Cleanup**: Automatische Bereinigung bei Host-Einträgen vor dem Hinzufügen neuer

### 🛡️ Security & Reliability
- **Exact Host Matching**: `^127\.0\.0\.1[[:space:]]+instancename\.local[[:space:]]*$` Pattern verhindert False-Positives
- **SSL Protocol Optimization**: Separate HTTP (Port 80) und HTTPS (Port 443) VirtualHosts mit korrekten Redirects  
- **Apache Module Management**: Korrekte SSL-Modul Aktivierung/Deaktivierung basierend auf SSL-Einstellungen
- **Backup Integration**: Automatische hosts-Datei Backups vor Änderungen

### 🔧 Technical Improvements
- **cleanupHostsFile()**: Neue Funktion entfernt duplicate Einträge vor dem Hinzufügen
- **Enhanced SSL Setup**: HTTP VirtualHost mit Redirect zu HTTPS verhindert Mixed-Content Fehler
- **Improved Error Handling**: Bessere Fehlerbehandlung bei hosts-Datei Operationen
- **Bundle Size**: 234 KiB mit allen neuen Host-Management Features

## [1.6.1] - 2025-08-28

### 🔑 Enhanced Database Access
- **MySQL Root User Support**: Vollständiger MySQL Root-User Zugang für beide Instanztypen (REDAXO und Custom)
- **Expanded Credentials Display**: Separate Bereiche für Standard User und Root User in beiden Verbindungstypen
- **Enhanced Copy Functionality**: 16+ Copy-Buttons für alle Database-Credentials inklusive Root-User
- **Unified Database Management**: Einheitliche Root-User Funktionalität für Standard REDAXO und Custom Instances
### ✨ UI Improvements
- **Clear User Separation**: Deutliche Trennung zwischen Standard User (redaxo/instanceName) und Root User
- **Complete Credential Coverage**: Sowohl interne (Container-zu-Container) als auch externe (localhost:port) Root-User Credentials
- **Enhanced Security**: Vollständiger Zugang zu MySQL Root-Funktionalität für erweiterte Database-Administration
- **Copy-Button Enhancement**: Ein-Klick-Kopieren für alle User-Typen und Verbindungsarten

### 🔧 Technical
- **DockerService Enhancement**: Erweiterte `getLoginInfo()` mit `dbRootPassword` für beide Instanztypen
- **Root Password Detection**: Automatische Erkennung von `DB_ROOT_PASSWORD`/`MYSQL_ROOT_PASSWORD` (REDAXO) und `'root'` (Custom)
- **JavaScript Functions**: Neue Copy-Funktionen für Root-User Credentials (intern/extern)
- **Bundle Optimization**: Effiziente Integration ohne signifikante Größenzunahme (218 KiB)

## [1.6.0] - 2025-08-28

### 🚀 Major Improvements
- **Simplified REDAXO Setup**: Komplett vereinfachte Installation durch Nutzung der nativen Docker Image Auto-Setup Funktionalität
- **Eliminated Installation Conflicts**: Behebt "User admin already exists" Fehler durch Wegfall komplexer Database-Cleanup Routinen
- **Native Docker Integration**: Voll auf FriendsOfREDAXO/docker-redaxo Image Auto-Installation optimiert
- **Reduced Bundle Size**: Code-Optimierung reduziert Bundle-Größe von 215 KiB auf 212 KiB

### ✨ Enhanced
- **Streamlined Setup Process**: Setup-Script fokussiert sich auf Login-Informationen statt komplexe Database-Management
- **Preserved SSL/HTTPS**: Alle SSL-Zertifikat und HTTPS-Funktionen bleiben vollständig erhalten
- **Environment Variable Setup**: Optimierte REDAXO_* Environment Variables für nahtlose Auto-Installation
- **Maintainable Codebase**: Deutlich einfachere und wartbarere Code-Struktur

### 🔧 Technical
- **Docker Image Compatibility**: 100% kompatibel mit friendsofredaxo/docker-redaxo Auto-Setup Features
- **SSL Configuration**: Beibehaltung aller mkcert-basierten SSL-Konfigurationen und Apache-Einstellungen
- **Database Persistence**: MySQL Volume-Persistenz funktioniert jetzt konfliktfrei mit Auto-Installation

## [1.5.2] - 2025-08-27

### 🔧 Fixed
- **MySQL External Access**: Verbesserte MySQL Port-Mapping für externe Datenbankverbindungen
- **Login Information**: Vollständige Anzeige von internen und externen Datenbankzugangsdaten
- **Custom Instances**: MySQL Ports werden jetzt korrekt für Custom Instances zugewiesen
- **Port Management**: Automatische Zuweisung freier MySQL Ports für alle Instanztypen

### ✨ Enhanced
- **Database Credentials**: Separate Bereiche für interne (Container-zu-Container) und externe (localhost:port) Verbindungen
- **Copy Functionality**: 10+ Copy-Buttons für alle Datenbankverbindungsparameter
- **Instance Detection**: Verbesserte Erkennung von Custom vs. REDAXO Instanzen für korrekte Credential-Anzeige

## [1.5.1] - 2025-08-26

### 🎨 Changed
- **Activity Bar Icon**: Neues großes, fettes "R" Icon für bessere Sichtbarkeit
- **Visual Branding**: Optimierte REDAXO Erkennbarkeit in VS Code Activity Bar
- **Icon Format**: Monochrome SVG mit automatischer Theme-Anpassung

## [1.5.0] - 2025-08-26

All notable changes to the "redaxo-multi-instances-manager" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.4.0] - 2025-08-26

### Added
- **Help & Documentation System**: Comprehensive help page with quick start guide
- **Intuitive Instance Interaction**: Single-click on instances now opens action menu
- **Built-in Help Button**: Question mark icon in toolbar for easy access to documentation
- **Instance Type Comparison**: Clear explanation of Custom Instance vs. Create Instance difference

### Changed
- **Instance Click Behavior**: Single-click now shows action menu instead of opening browser
- Right-click context menu still available for power users

## [1.3.0] - 2025-08-26

### Added
- Visual Instance Type Distinction in TreeView with different icons and labels
- Copy buttons for login information (URLs, credentials, etc.)
- Enhanced hosts file management with duplicate detection
- Unified PHP configuration templates across all instance types
- Dynamic release script with automatic version detection from package.json

### Fixed
- SSL certificate mounting path corrected to `/etc/apache2/ssl`
- REDAXO console parameter fixed (`--servername` instead of `--server-name`)
- Apache container startup issues resolved
- PHP limits inconsistencies between standard and custom instances
- Duplicate hosts file entries prevention

### Changed
- Custom instances now show "Custom" label and package icon in TreeView
- Standard REDAXO instances show "REDAXO" label and server-environment icon
- Improved tooltips with instance type information
- Enhanced hosts file dialog with better user experience

## [1.1.0] - Previous Release

### Added
- Custom Instance support (renamed from Empty Instance)
- Improved path detection for workspace/finder operations

### Removed
- Database Information command and context menu

### Changed
- PHP version selection limited to 7.4 and 8.1-8.5
- MariaDB consolidated to version 11.3
- Updated branding and versioning

## [Unreleased]

- Initial release