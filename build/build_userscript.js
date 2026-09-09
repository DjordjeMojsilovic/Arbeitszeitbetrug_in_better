#!/usr/bin/env node
/**
 * Concatenates the shared src/ modules into a single Tampermonkey userscript.
 * No npm dependencies — plain Node string concatenation, run with:
 *   node build/build_userscript.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'tampermonkey', 'arcade_widget.user.js');

const SOURCES = [
  'src/core/cards.js',
  'src/core/wallet.js',
  'src/core/board-games.js',
  'src/core/casino-games.js',
  'src/core/p2p.js',
  'src/ui/theme.js',
  'src/ui/casino-panels.js',
  'src/ui/app.js',
  'src/entry-floating.js'
];

const HEADER = `// ==UserScript==
// @name         💼 Arbeitszeitbetrug Arcade & Casino (P2P, 14 Spiele)
// @namespace    https://github.com/arbeitszeitbetrug-arcade
// @version      5.0.0
// @description  Floating Arcade & Casino Widget: Tic-Tac-Toe, 4-Gewinnt, Schach und 11 Casino-Spiele mit P2P WebRTC Online-Modus — ohne Server, ohne Datenbank.
// @author       Arbeitszeitbetrug
// @match        http://*/*
// @match        https://*/*
// @grant        GM_registerMenuCommand
// @run-at       document-end
// @require      https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js
// ==/UserScript==

// This file is generated — do not edit directly.
// Source of truth: src/**/*.js — run \`node build/build_userscript.js\` to regenerate.
`;

function build() {
  const parts = [HEADER, '\n(function () {\n\'use strict\';\n'];
  for (const relPath of SOURCES) {
    const full = path.join(ROOT, relPath);
    const code = fs.readFileSync(full, 'utf8');
    parts.push(`\n// ---- ${relPath} ----\n`);
    parts.push(code);
  }
  parts.push('\n})();\n');
  fs.writeFileSync(OUT_FILE, parts.join(''));
  console.log('Built', OUT_FILE);
}

build();
