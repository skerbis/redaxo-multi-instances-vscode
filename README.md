# 🚀 REDAXO Multi-Instances Manager 

👉 Für macOs und Linux

Based on: [Docker image for REDAXO](https://github.com/FriendsOfREDAXO/docker-redaxo) Danke Dirk! 🙏

![Screenshot](https://github.com/FriendsOfREDAXO/redaxo-multi-instances-vscode/blob/main/screenshot.png?raw=true)

Eine  TreeView (Seitenleiste)
- **Server-Symbol** = REDAXO-Instanz (Grün=läuft, Gelb=gestoppt, Rot=Fehler)
- **Paket-Symbol** = Custom-Instanz (Grün=läuft, Gelb=gestoppt, Rot=Fehler)
- **● / ○** in Beschreibung = Status (gefüllt=läuft, leer=gestoppt)
- **Klick auf Instanz** öffnet Aktionsmenü (intuitiver Zugriff)
- Rechtsklick für Kontext-Menü (wie gehabt)
- **❓ Help-Button** in der Toolbar für schnelle HilfeS Code Extension zur Verwaltung mehrerer REDAXO-Instanzen ("Custom Instances") mit Docker, SSL-Support und modernem Dashboard.

![VS Code](https://img.shields.io/badge/VS%20Code-Extension-blue?style=flat-square&logo=visual-studio-code)
![Docker](https://img.shields.io/badge/Docker-Required-blue?style=flat-square&logo=docker)
![REDAXO](https://img.shields.io/badge/REDAXO-5.x-green?style=flat-square)
![PHP](https://img.shields.io/badge/PHP-7.4%20|%208.1--8.5-purple?style=flat-square&logo=php)
![MariaDB](https://img.shields.io/badge/MariaDB-11.3-blue?style=flat-square)
![SSL](https://img.shields.io/badge/SSL-mkcert-orange?style=flat-square&logo=letsencrypt)

## ✨ Features

### 🎯 Kern-Funktionen
- **🏗️ Instanz-Management** - Erstellen, starten, stoppen und löschen von REDAXO-Instanzen
- **🐘 PHP-Version wechseln (Custom)** - PHP-Version pro Custom-Instanz ändern (mit Rebuild)
- **🗄️ MariaDB-Version wechseln** - MariaDB-Version pro Instanz umstellen (Container-Recreate)
- **🤖 Copilot Chat Integration** - Verwalte Instanzen direkt via GitHub Copilot Chat mit @redaxo
- **🎯 Custom Instance Support** - Vollständige Unterstützung für Custom REDAXO Instanzen mit individuellen Verzeichnisstrukturen
- **⚡ Direkte Instance-Kommunikation** - Console Commands, Datenbank-Queries, Logs - alles aus VS Code
- **🔍 Smart Path Detection** - Automatische Erkennung verschiedener REDAXO-Verzeichnisstrukturen
- **🔒 SSL/HTTPS Support** - Automatische SSL-Zertifikate mit mkcert
- **🐳 Docker Integration** - Vollständig containerisierte Umgebung
- **📊 Info Pages** - Modernes Webview-Dashboard je Instanz
- **🔑 Login-Informationen** - Automatische Anzeige von Zugangsdaten und URLs
- **📱 TreeView** - Seitenleiste mit allen Instanzen und deren Status

### ℹ️ Wichtiger Hinweis zur Instanzliste
- **Stopped Instances** sind normale, vorhandene Instanzen, die aktuell nicht laufen.
- Sie sind **nicht** verwaist und **keine Core-Sessions**.
- Eine Instanz wie `core` ist einfach ein Instanzname aus deinem konfigurierten Instances-Ordner.

### 🔧 Technische Features
- **PHP Support** - PHP 7.4, 8.1, 8.2, 8.3, 8.4, 8.5
- **MariaDB Support** - 10.6, 10.11, 11.4, 11.8 (LTS) und 12.2 (Rolling)
- **🗄️ Adminer Integration** - Globaler Adminer-Container für Datenbankverwaltung
- **� Multi-Database Support** - Erstelle zusätzliche Datenbanken pro Instanz über die UI
- **�🚀 Dynamic Path Resolution** - Intelligente Erkennung von Console-Pfaden und REDAXO-Strukturen
- **⚡ Performance Caching** - Path-Detection wird gecacht für schnellere Zugriffe
- **Port Management** - Automatische Port-Zuweisung und -Verwaltung
- **SSL Zertifikate** - Lokale Entwicklungszertifikate mit mkcert
- **Docker Compose** - Automatische Container-Orchestrierung
- **Docker Images** - Basiert auf [friendsofredaxo/redaxo](https://github.com/FriendsOfREDAXO/docker-redaxo) und [mariadb](https://hub.docker.com/_/mariadb) Images

## 🚀 Installation

### Voraussetzungen

1. **VS Code** (Version 1.74.0 oder höher)
2. **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop)
3. **mkcert** (optional, für SSL)

### Extension Installation

#### Option 1: VSIX Package (Aktuell)
1. VSIX-Datei von [Releases](https://github.com/FriendsOfREDAXO/redaxo-multi-instances-vscode/releases) herunterladen
2. VS Code öffnen
3. `Cmd+Shift+P` → "Extensions: Install from VSIX"
4. VSIX-Datei auswählen und installieren

#### Option 2: Repository klonen
```bash
git clone https://github.com/FriendsOfREDAXO/redaxo-multi-instances-vscode.git
cd redaxo-multi-instances-vscode
npm install
npm run compile
```

## 🏁 Erste Schritte

1. **Extension aktivieren** - `Cmd+Shift+P` → `REDAXO: Show Dashboard`
2. **Erste Instanz erstellen** - `REDAXO: Create New Instance`
3. **Instanz konfigurieren** - Name, PHP-Version (7.4 + 8.1–8.5), MariaDB 11.8 LTS
4. **SSL aktivieren** - Optional für HTTPS-Support
5. **Zugriff** - Automatisch generierte URLs verwenden

## 📖 Verwendung

### 🤖 GitHub Copilot Chat Integration

**REDAXO Multi-Instances** bietet einen Chat Participant für GitHub Copilot Chat, mit dem du deine REDAXO-Instanzen direkt aus dem Chat heraus verwalten kannst!

#### Chat Participant verwenden

Öffne GitHub Copilot Chat und verwende **@redaxo** um mit deinen Instanzen zu interagieren:

```
@redaxo /start demo-site
@redaxo /console demo-site cache:clear
@redaxo /query demo-site SELECT * FROM rex_article LIMIT 5
```

#### Verfügbare Slash Commands

| Command | Beschreibung | Beispiel |
|---------|--------------|----------|
| `/create` | Neue Instanz erstellen | `@redaxo /create` |
| `/start [name]` | Instanz starten | `@redaxo /start demo-site` |
| `/stop [name]` | Instanz stoppen | `@redaxo /stop demo-site` |
| `/console <instance> <command>` | REDAXO Console Command ausführen | `@redaxo /console demo-site cache:clear` |
| `/query <instance> <SQL>` | SQL Query ausführen | `@redaxo /query demo-site SELECT * FROM rex_article` |
| `/articles [instance]` | Artikel auflisten | `@redaxo /articles demo-site` |
| `/addons [instance]` | AddOns verwalten | `@redaxo /addons demo-site` |
| `/config <instance> <key>` | Config-Werte lesen | `@redaxo /config demo-site server` |
| `/logs <instance>` | Container-Logs anzeigen | `@redaxo /logs demo-site` |
| `/install-tools <instance>` | CLI-Tools installieren | `@redaxo /install-tools demo-site` |

#### Praktische Anwendungsfälle

**Cache verwalten:**
```
@redaxo /console demo-site cache:clear
@redaxo /console demo-site cache:warmup
```

**Datenbank abfragen:**
```
@redaxo /query demo-site SELECT id, name FROM rex_article WHERE status=1
@redaxo /query demo-site SHOW TABLES
```

**AddOns verwalten:**
```
@redaxo /console demo-site package:list
@redaxo /console demo-site package:install yform
@redaxo /console demo-site package:activate yform
```

**Debugging:**
```
@redaxo /logs demo-site
@redaxo /config demo-site debug
@redaxo /query demo-site SELECT * FROM rex_system_log ORDER BY id DESC LIMIT 10
```

**CLI-Tools installieren:**
```
@redaxo /install-tools demo-site
```
Installiert automatisch:
- **Web Container**: vim, nano, curl, wget, unzip, git
- **DB Container**: mariadb/mariadb-dump (MariaDB) oder mysql/mysqldump (MySQL), vim, nano

Die Extension erkennt automatisch, ob es sich um einen MariaDB oder MySQL Container handelt und verwendet die nativen Tools des jeweiligen Datenbanksystems.

### 🗄️ Adminer - Datenbank-Management

**REDAXO Multi-Instances** enthält einen globalen Adminer-Container für einfache Datenbankverwaltung:

#### Features
- 🚀 **One-Click Access**: Rechtsklick auf laufende Instanz → "Open in Adminer"
- 🔗 **Auto-Login**: Browser öffnet mit vorausgefüllten Credentials (Server, Username, Database)
- 📋 **Clipboard Integration**: Passwort wird automatisch kopiert - einfach einfügen (Cmd+V)
- 📊 **Large File Support**: 512MB Upload-Limit für große Dumps
- 🌐 **Port 9200**: Adminer läuft auf http://localhost:9200
- 🐳 **Network Integration**: Automatische Verbindung zu DB-Containern

#### Verwendung
1. **Instanz starten** (muss laufen)
2. **Rechtsklick** auf Instanz in TreeView
3. **"Open in Adminer"** wählen
4. Browser öffnet sich mit vorausgefüllten Feldern
5. **Passwort einfügen** (Cmd+V) - wurde automatisch kopiert
6. **Login** - fertig!

#### Manuelle Steuerung
- `Cmd+Shift+P` → `REDAXO: Start Adminer` - Adminer manuell starten
- `Cmd+Shift+P` → `REDAXO: Stop Adminer` - Adminer stoppen

#### Technische Details
- Container: `redaxo-adminer` auf Port 9200
- Image: `adminer:latest`
- PHP Limits: 512MB upload_max_filesize, post_max_size, memory_limit
- Netzwerk: `redaxo-adminer-network` für Container-Kommunikation
- Unterstützt Custom und Standard REDAXO Instanzen

### 💾 Multi-Database Support

Erstelle zusätzliche Datenbanken für deine REDAXO-Instanzen - perfekt für Multi-Mandanten-Systeme oder separate Entwicklungs-Datenbanken!

#### Features
- 🎯 **One-Click Creation**: Rechtsklick auf laufende Instanz → "Create Additional Database"
- ✅ **Name Validation**: Automatische Prüfung auf gültige Datenbanknamen
- 📋 **Existing Databases**: Zeigt alle vorhandenen Datenbanken an
- 🔐 **Auto-Credentials**: Verwendet automatisch Root-Credentials des Containers
- 🌍 **UTF8MB4**: Standard Charset/Collation (utf8mb4_unicode_ci)
- ⚡ **Quick Access**: Direkter Link zu Adminer nach Erstellung

#### Verwendung
1. **Instanz muss laufen** (Database-Creation nur bei aktiven Instanzen)
2. **Rechtsklick** auf Instanz in TreeView
3. **"Create Additional Database"** wählen
4. **Datenbanknamen eingeben** (z.B., `shop_db`, `staging_db`)
   - Nur Buchstaben, Zahlen und Unterstriche erlaubt
   - Max. 64 Zeichen
5. **Bestätigen** - Datenbank wird erstellt!
6. Optional: **"Open in Adminer"** für sofortige Verwaltung

#### Anwendungsfälle
- **Multi-Mandanten-Systeme**: Separate Datenbank pro Mandant
- **Testing**: Test-Datenbank neben Production-DB
- **Staging**: Staging-Datenbank für sichere Tests
- **Backup**: Temporäre Backup-Datenbank
- **Development**: Separate Dev-Datenbank

#### Beispiel
```
Instanz: demo-site (läuft)
Standard DB: redaxo

Neue DBs erstellen:
- shop_db          → E-Commerce Daten
- staging_redaxo   → Staging-Umgebung
- test_db          → Unit Tests
```

Alle Datenbanken sind direkt über Adminer oder die Console erreichbar!

### Alle VS Code Kommandos (Auswahl)
- `REDAXO: Create New Instance` - Neue Instanz erstellen
- `REDAXO: Show Dashboard` - Dashboard öffnen
- `REDAXO: Show Login Info` - Login-Daten anzeigen (inkl. DB-Zugang)
- `REDAXO: Start/Stop Instance` - Instanzen verwalten
- `REDAXO: Open in Adminer` - Datenbankverwaltung mit Adminer
- `REDAXO: Create Additional Database` - 💾 Zusätzliche Datenbank erstellen
- `REDAXO: Setup HTTPS/SSL` - SSL für Instanz einrichten
- **`REDAXO: Show Help & Documentation`** - 📖 Vollständige Anleitung & Hilfe

### Kontextmenü (Rechtsklick auf Instanz)
- **Start/Stop Instance** - Container starten/stoppen
- **Open in Adminer** - Datenbank verwalten (nur bei laufenden Instanzen)
- **Create Additional Database** - 💾 Zusätzliche Datenbanken erstellen (nur bei laufenden Instanzen)
- **Show REDAXO Logs** - redaxo.log und system.log anzeigen
- **Install CLI Tools** - vim, nano, curl, wget, git, mysql/mariadb installieren
- **Login Information** - Zugangsdaten anzeigen
- **Import Dump** - removed (use Adminer for import/export)
- **Setup HTTPS/SSL** - SSL-Zertifikate einrichten
- **Open Workspace** - Projekt-Ordner in VS Code öffnen
- **Delete Instance** - Instanz entfernen

### TreeView (Seitenleiste)
- �️ **Server-Symbol** = REDAXO-Instanz (Grün=läuft, Gelb=gestoppt, Rot=Fehler)
- � **Paket-Symbol** = Custom-Instanz (Grün=läuft, Gelb=gestoppt, Rot=Fehler)
- **● / ○** in Beschreibung = Status (gefüllt=läuft, leer=gestoppt)
- **Klick auf Instanz** öffnet Aktionsmenü (intuitiver Zugriff)
- Rechtsklick für Kontext-Menü (wie gehabt)
- **❓ Help-Button** in der Toolbar für schnelle Hilfe

### 🎯 Unterschied: REDAXO-Instanz vs. Custom Instance
- **🆕 + Button (Create Instance)**: Vollständige REDAXO-Installation, sofort nutzbar
- **📦 Custom Instance**: Leere PHP-Instanz für eigene Projekte (ja auch das CMS mit dem W oder Laravel) oder manuelle REDAXO-Installation

### 🚀 REDAXO Loader für Custom Instances
Für Custom Instances mit automatischer REDAXO-Installation:
1. [REDAXO Loader](https://redaxo.org/loader) herunterladen
2. In `project/public/` Ordner der Custom Instance kopieren
3. Instance im Browser öffnen und REDAXO installieren

## 🔒 SSL/HTTPS Setup (Optional)

### macOS
```bash
brew install mkcert nss
mkcert -install
```

### Linux
```bash
sudo apt install libnss3-tools
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo cp mkcert-v*-linux-amd64 /usr/local/bin/mkcert
mkcert -install
```

### Zugriff auf HTTPS-Instanzen
- **Frontend**: `https://instancename.local:8443`
- **Backend**: `https://instancename.local:8443/redaxo/`

## 🔧 Troubleshooting

### Container startet nicht
```bash
docker logs redaxo-instanzname
docker ps -a | grep redaxo
```

### SSL-Zertifikat nicht vertrauenswürdig
```bash
mkcert -uninstall
mkcert -install
```

### Domain nicht erreichbar
```bash
cat /etc/hosts | grep instancename.local
sudo dscacheutil -flushcache  # macOS
```

## 👨‍💻 Entwicklung

```bash
git clone https://github.com/FriendsOfREDAXO/redaxo-multi-instances-vscode.git
cd redaxo-multi-instances-vscode
npm install
npm run compile
npm run watch  # Watch-Modus
F5  # Development Host starten
```

## 🤝 Beitragen
---

1. Repository forken
2. Feature Branch erstellen: `git checkout -b feature/name`
3. Änderungen committen: `git commit -m 'Add feature'`
4. Branch pushen: `git push origin feature/name`
5. Pull Request erstellen

## 📞 Support

- **GitHub Issues**: [Issues erstellen](https://github.com/FriendsOfREDAXO/redaxo-multi-instances-vscode/issues)
- **REDAXO Community**: [REDAXO Slack](https://redaxo.org/slack/)

## Lead

[Thomas Skerbis](https://github.com/skerbis)

---

**Made by [FriendsOfREDAXO](https://github.com/FriendsOfREDAXO) 
