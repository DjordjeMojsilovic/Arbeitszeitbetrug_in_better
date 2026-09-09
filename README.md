# 🎮 Arbeitszeitbetrug Arcade & Casino

Ein schwebendes Arcade- & Casino-Widget für jede Website — jetzt mit **14 Spielen**, einem eigenen **Casino-Tab**, echtem **Peer-to-Peer-Mehrspielermodus** (kein Server, keine Datenbank) und lauffähig als **Browser-Extension**, **Tampermonkey-Userscript** und **eigenständige, installierbare App** (PWA) auf jeder Plattform.

Design orientiert sich an Apples Human-Interface-Guidelines: systemBlue-Akzent, SF-Pro-Typografie, 8pt-Rastermaß, 44pt-Mindesttippfläche, adaptives Hell/Dunkel und durchscheinende „Liquid Glass“-Flächen.

---

## ✨ Funktionsumfang

### 🕹️ Arcade-Tab
- **Tic-Tac-Toe**, **4 Gewinnt**, **Schach** (mit Rochade & strikten Bauernregeln)
- Drei Modi je Spiel: **🤖 gegen KI**, **👥 lokal (Pass & Play)**, **🌐 online per P2P**

### 🎰 Casino-Tab (11 Spiele)
| Spiel | Beschreibung |
|---|---|
| Spielautomat | 3 Walzen, Jackpot- und Mini-Win-Kombinationen |
| Blackjack | Klassisches 21 gegen den Dealer |
| Roulette | Europäisch (einfache Null), Farbe/Zahl/Dutzend-Wetten |
| Video Poker | Jacks-or-Better mit Hold/Draw |
| Baccarat | Spieler/Banker/Unentschieden nach offiziellen Ziehregeln |
| Craps | Vereinfachtes Pass-Line-Spiel — **auch als 🌐 Duell gegen einen Freund** |
| Sic Bo | Groß/Klein/Pasch-Wetten mit drei Würfeln |
| Höher/Tiefer | Kartenraten mit Streak-Multiplikator — **auch als 🌐 Duell** |
| Münzwurf | Doppelt oder nichts — **auch als 🌐 Duell** |
| Plinko | Fallender Ball mit Risikostufen (niedrig/mittel/hoch) |
| Glücksrad | 20 Felder mit unterschiedlichen Multiplikatoren |

Alle Casino-Spiele teilen sich ein virtuelles Coin-Guthaben (`CasinoWallet`), das lokal in `chrome.storage` bzw. `localStorage` gespeichert wird — **kein Server, keine Datenbank, kein Echtgeld**.

### 🌐 Peer-to-Peer ohne Server
WebRTC via PeerJS stellt die direkte Verbindung zwischen zwei Browsern her. Der öffentliche PeerJS-Signalisierungsdienst wird nur für den allerersten Verbindungsaufbau (4-stelliger PIN) genutzt — danach läuft der gesamte Spielverkehr direkt Peer-zu-Peer, ganz ohne eigenes Backend.

---

## 📁 Architektur

```
src/
├── core/                  # Reine Logik, kein DOM — für alle drei Ziele geteilt
│   ├── cards.js           # Kartendeck-Utilities (Shuffle, Blackjack-Wert, ...)
│   ├── wallet.js          # Gemeinsames Coin-Guthaben
│   ├── board-games.js     # TicTacToe-, Connect4-, Chess-Engines
│   ├── casino-games.js    # 11 Casino-Engines
│   └── p2p.js             # WebRTC P2P-Verbindungsmanager (PeerJS)
├── ui/
│   ├── theme.js           # Apple-HIG-Design-Tokens & Komponenten-CSS
│   ├── casino-panels.js   # Renderer je Casino-Spiel (inkl. Duell-Modi)
│   └── app.js             # Haupt-Shell: Arcade-Tab, Casino-Tab, Social-Panel
├── entry-floating.js      # Bootstrap für Extension & Tampermonkey (Shadow-DOM-Widget)
└── entry-webapp.js        # Bootstrap für die eigenständige Web-App (Vollbild)
```

Ein Modul, drei Auslieferungsziele:

1. **Browser-Extension** (`manifest.json`) lädt die `src/`-Dateien direkt als Content-Script-Liste — kein Build nötig.
2. **Tampermonkey-Userscript** (`tampermonkey/arcade_widget.user.js`) wird aus denselben Quelldateien generiert:
   ```bash
   node build/build_userscript.js
   ```
   Nie die generierte Datei direkt bearbeiten — Änderungen gehören in `src/`.
3. **Eigenständige App / PWA** (`webapp/index.html`) lädt dieselben Module Vollbild und ist über `manifest.webmanifest` + `service-worker.js` auf Desktop und Mobilgeräten installierbar ("Zum Startbildschirm hinzufügen" / "App installieren") — läuft offline (außer für den initialen P2P-Verbindungsaufbau).

---

## 🚀 Installation

### Option A: Chrome / Edge / Brave Extension
1. `chrome://extensions` öffnen, **Entwicklermodus** aktivieren.
2. **Entpackte Erweiterung laden** → dieses Projektverzeichnis auswählen.
3. Beliebige Website öffnen — das Widget erscheint oben rechts.

### Option B: Tampermonkey / Violentmonkey Userscript
1. [Tampermonkey](https://www.tampermonkey.net/) installieren.
2. `tampermonkey/arcade_widget.user.js` öffnen, Inhalt kopieren, als neues Skript einfügen.
3. Speichern — auf jeder Website aktiv.

### Option C: Eigenständige App (Web / Desktop / Mobil)
1. `webapp/index.html` über einen beliebigen statischen Webserver ausliefern (z. B. `npx http-server .`) oder direkt öffnen.
2. Im Browser über **„App installieren“** bzw. **„Zum Startbildschirm hinzufügen“** installieren — läuft danach als eigenständiges Fenster/App-Icon auf Windows, macOS, Linux, Android und iOS.

---

## 🎮 Mehrspieler nutzen

1. Über den 🌐-Button oben rechts das Online-Panel öffnen.
2. **Host**: „PIN erstellen“ klicken, 4-stelligen Code an den Freund schicken.
3. **Gast**: PIN eingeben, „Beitreten“ klicken.
4. Sobald verbunden, steht im Arcade-Tab der Modus „🌐 Online“ zur Verfügung; im Casino-Tab bieten Craps, Höher/Tiefer und Münzwurf einen „🌐 Gegen Freund“-Duellmodus.

Tastenkombination `Alt + A` blendet das Widget ein/aus.

---

## 📁 Weitere Dateien

```
manifest.json             # Manifest V3 Extension-Konfiguration
popup/                    # Extension-Popup (Toolbar-Icon)
lib/peerjs.min.js         # Gebündelte PeerJS-Bibliothek (Extension)
tampermonkey/             # Generiertes Einzeldatei-Userscript
webapp/                   # Eigenständige PWA (index.html, manifest, service worker, Icons)
build/build_userscript.js # Build-Skript für das Userscript
```
