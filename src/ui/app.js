/**
 * ArcadeApp — the shared application shell.
 * Renders into either a floating Shadow DOM widget (browser extension /
 * Tampermonkey userscript) or a full page (standalone web app / PWA).
 * Owns the board-game tab, the Casino tab, the leaderboard/network tab,
 * the shared P2P connection and the shared casino wallet.
 */
(function (root) {
  'use strict';

  const STATE_KEY = 'arcade_app_state_v5';
  const Icon = (name, opts) => window.AZIcon(name, opts);

  class SoundEngine {
    constructor() { this.muted = true; }
    _ctx() {
      if (!this._audioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this._audioCtx = new AudioCtx();
      }
      return this._audioCtx;
    }
    _beep(freq, type, duration) {
      if (this.muted) return;
      const ctx = this._ctx();
      if (!ctx) return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + duration);
      } catch (e) {}
    }
    play(name) {
      if (name === 'click') this._beep(440, 'sine', 0.05);
      else if (name === 'move') this._beep(480, 'triangle', 0.08);
      else if (name === 'win') [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._beep(f, 'triangle', 0.18), i * 90));
      else if (name === 'lose') this._beep(180, 'sawtooth', 0.25);
      else if (name === 'spin') [300, 360, 420].forEach((f, i) => setTimeout(() => this._beep(f, 'sine', 0.05), i * 60));
    }
  }

  class ArcadeApp {
    constructor(mountRoot, opts = {}) {
      this.root = mountRoot; // element to query within (shadow root or div)
      this.mode = opts.mode || 'floating'; // 'floating' | 'fullpage'
      this.wallet = new window.CasinoWallet();
      this.sound = new SoundEngine();
      this.p2p = new window.P2PNetworkManager();
      this.username = `Spieler${Math.floor(100 + Math.random() * 900)}`;

      this.ledger = null; // PlayerLedger, loaded asynchronously
      this._pendingResults = []; // queued until the ledger finishes loading
      this.network = new window.NetworkLedger();

      this.activeTab = 'arcade'; // 'arcade' | 'casino' | 'leaderboard'
      this.activeBoardGame = 'tictactoe';
      this.boardMode = 'ai'; // 'ai' | 'local' | 'p2p'
      this.activeCasinoGame = null;
      this.casinoDuelHandler = null;
      this.socialOpen = false;
      this.isCollapsed = false;

      this.ttt = new window.TicTacToeEngine();
      this.c4 = new window.Connect4Engine();
      this.chess = new window.ChessEngine();

      this._bindP2P();
      this.wallet.onChange((bal) => {
        this.root.querySelectorAll('[data-wallet-badge]').forEach(el => {
          el.textContent = `${bal.toLocaleString('de-DE')}`;
        });
      });
    }

    _bindP2P() {
      this.p2p.callbacks.onConnected = () => {
        this.updateSocialStatus('Verbunden.');
        this.boardMode = 'p2p';
        this.resetActiveBoardGame();
        this._sendLedgerSync();
        this.render();
      };
      this.p2p.callbacks.onDisconnected = () => {
        this.updateSocialStatus('Getrennt.');
        this.boardMode = 'ai';
        this.render();
      };
      this.p2p.callbacks.onError = (msg) => this.updateSocialStatus(msg);
      this.p2p.callbacks.onData = (data) => {
        if (!data || !data.type) return;
        if (data.type === 'HANDSHAKE') { this.updateSocialStatus(`Verbunden mit ${data.name || 'Mitspieler'}`); return; }
        if (data.scope === 'board') { this._handleBoardData(data); return; }
        if (data.scope === 'casino' && this.casinoDuelHandler) { this.casinoDuelHandler(data); return; }
        if (data.scope === 'ledger' && data.type === 'SYNC') { this._receiveLedgerSync(data.payload); return; }
      };
    }

    async _sendLedgerSync() {
      if (!this.ledger) return;
      this.network.setLocal(this.ledger.deviceId, this.username, this.ledger.chain);
      this.p2p.send({ scope: 'ledger', type: 'SYNC', payload: this.network.exportPayload() });
    }

    async _receiveLedgerSync(payload) {
      const { learned, updated } = await this.network.mergeAll(payload);
      if (learned || updated) {
        // Gossip forward: reply with our (now larger) network view so both
        // sides converge even if the peer only knew a subset.
        this.p2p.send({ scope: 'ledger', type: 'SYNC', payload: this.network.exportPayload() });
        if (this.activeTab === 'leaderboard') this._renderBody();
      }
    }

    async _recordResult(game, result, delta) {
      if (!this.ledger) { this._pendingResults.push([game, result, delta]); return; }
      await this.ledger.addResult(game, result, delta || 0);
      this.network.setLocal(this.ledger.deviceId, this.username, this.ledger.chain);
      if (this.p2p.isConnected()) this._sendLedgerSync();
      if (this.activeTab === 'leaderboard') this._renderBody();
    }

    updateSocialStatus(text) {
      const el = this.root.querySelector('#az-social-status');
      if (el) el.textContent = text;
    }

    async mount() {
      this.render();
      this.ledger = await window.PlayerLedger.load(this.username);
      await this.network.load();
      const queued = this._pendingResults.splice(0);
      for (const [game, result, delta] of queued) await this.ledger.addResult(game, result, delta || 0);
      this.network.setLocal(this.ledger.deviceId, this.username, this.ledger.chain);
      if (this.p2p.isConnected()) this._sendLedgerSync();
      if (this.activeTab === 'leaderboard') this._renderBody();
    }

    render() {
      const isFloating = this.mode === 'floating';
      this.root.innerHTML = `
        <div class="az-root ${isFloating ? 'az-floating-root' : 'az-fullpage-root'}">
          ${isFloating ? `<button id="az-pill" class="az-pill ${this.isCollapsed ? '' : 'az-hidden'}">${Icon('controller', { size: 18 })}<span>Arcade</span></button>` : ''}
          <div id="az-window" class="az-window az-glass ${this.isCollapsed ? 'az-hidden' : ''}">
            <div id="az-header" class="az-header">
              <div class="az-flex az-gap-2 az-text-title3">${Icon('controller', { size: 20 })}<span>Arbeitszeitbetrug</span></div>
              <div class="az-flex az-gap-1">
                <button id="az-btn-social" class="az-btn az-btn-icon" title="Online spielen">${Icon('globe')}</button>
                <button id="az-btn-sound" class="az-btn az-btn-icon" title="Ton">${Icon(this.sound.muted ? 'speakerMute' : 'speaker')}</button>
                ${isFloating ? `<button id="az-btn-min" class="az-btn az-btn-icon" title="Minimieren">${Icon('minus')}</button>` : ''}
              </div>
            </div>

            <div id="az-social" class="az-card az-social-panel ${this.socialOpen ? '' : 'az-hidden'}">
              <div class="az-flex-between">
                <span class="az-flex az-gap-1 az-text-headline">${Icon('globe', { size: 15 })}<span>Online P2P — kein Server nötig</span></span>
                <span id="az-social-status" class="az-text-footnote">${this.p2p.isConnected() ? 'Verbunden' : 'Offline'}</span>
              </div>
              <div class="az-flex az-gap-2" style="margin-top:8px;">
                <input id="az-username" class="az-input" style="flex:1;" maxlength="14" value="${this.username}" placeholder="Dein Name">
              </div>
              <div class="az-flex az-gap-2" style="margin-top:8px;flex-wrap:wrap;">
                <button id="az-btn-host" class="az-btn az-btn-secondary az-btn-sm">PIN erstellen</button>
                <input id="az-pin-input" class="az-input" style="width:80px;" maxlength="4" placeholder="PIN">
                <button id="az-btn-join" class="az-btn az-btn-sm">Beitreten</button>
                <button id="az-btn-leave" class="az-btn az-btn-danger az-btn-sm ${this.p2p.isConnected() ? '' : 'az-hidden'}">Trennen</button>
              </div>
              <div id="az-pin-display" class="az-text-footnote" style="margin-top:6px;"></div>
            </div>

            <div class="az-segmented" style="margin: var(--az-space-2) var(--az-space-3) 0;">
              <button data-tab="arcade" class="az-flex az-gap-1 ${this.activeTab === 'arcade' ? 'az-active' : ''}">${Icon('controller', { size: 15 })}<span>Arcade</span></button>
              <button data-tab="casino" class="az-flex az-gap-1 ${this.activeTab === 'casino' ? 'az-active' : ''}">${Icon('coin', { size: 15 })}<span>Casino</span></button>
              <button data-tab="leaderboard" class="az-flex az-gap-1 ${this.activeTab === 'leaderboard' ? 'az-active' : ''}">${Icon('trophy', { size: 15 })}<span>Rangliste</span></button>
            </div>

            <div id="az-body" class="az-scroll" style="flex:1; padding: var(--az-space-3);"></div>
          </div>
        </div>`;

      this._attachShellEvents();
      this._renderBody();
    }

    _attachShellEvents() {
      const r = this.root;
      const pill = r.querySelector('#az-pill');
      if (pill) pill.onclick = () => { this.isCollapsed = false; this.render(); this._persist(); };

      const minBtn = r.querySelector('#az-btn-min');
      if (minBtn) minBtn.onclick = () => { this.isCollapsed = true; this.render(); this._persist(); };

      r.querySelector('#az-btn-sound').onclick = () => {
        this.sound.muted = !this.sound.muted;
        r.querySelector('#az-btn-sound').innerHTML = Icon(this.sound.muted ? 'speakerMute' : 'speaker');
      };

      r.querySelector('#az-btn-social').onclick = () => { this.socialOpen = !this.socialOpen; this.render(); };

      r.querySelectorAll('[data-tab]').forEach(btn => {
        btn.onclick = () => { this.activeTab = btn.getAttribute('data-tab'); this.activeCasinoGame = null; this.render(); };
      });

      if (this.socialOpen) {
        r.querySelector('#az-username').oninput = (e) => { this.username = e.target.value; if (this.ledger) this.ledger.setName(this.username); };
        r.querySelector('#az-btn-host').onclick = () => {
          const code = this.p2p.hostRoom(this.username);
          r.querySelector('#az-pin-display').textContent = `PIN: ${code} — an Freund weitergeben`;
          this.updateSocialStatus('Warte auf Verbindung…');
        };
        r.querySelector('#az-btn-join').onclick = () => {
          const pin = r.querySelector('#az-pin-input').value.trim();
          if (pin.length === 4) { this.p2p.joinRoom(pin, this.username); this.updateSocialStatus('Verbinde…'); }
        };
        r.querySelector('#az-btn-leave').onclick = () => { this.p2p.disconnect(); this.boardMode = 'ai'; this.render(); };
      }

      this._makeDraggable();
    }

    _makeDraggable() {
      if (this.mode !== 'floating') return;
      const header = this.root.querySelector('#az-header');
      const hostEl = this.hostElement;
      if (!header || !hostEl) return;
      let dragging = false, sx = 0, sy = 0, il = 0, it = 0;
      header.onmousedown = (e) => {
        if (e.target.closest('button')) return;
        dragging = true; sx = e.clientX; sy = e.clientY;
        const rect = hostEl.getBoundingClientRect();
        il = rect.left; it = rect.top;
        hostEl.style.right = 'auto'; hostEl.style.left = il + 'px'; hostEl.style.top = it + 'px';
      };
      if (!this._dragBound) {
        this._dragBound = true;
        document.addEventListener('mousemove', (e) => {
          if (!dragging) return;
          hostEl.style.left = (il + (e.clientX - sx)) + 'px';
          hostEl.style.top = (it + (e.clientY - sy)) + 'px';
        });
        document.addEventListener('mouseup', () => { dragging = false; this._persist(); });
      }
    }

    _persist() {
      const state = { isCollapsed: this.isCollapsed, activeTab: this.activeTab, username: this.username };
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [STATE_KEY]: state });
      } else {
        try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) {}
      }
    }

    _renderBody() {
      const body = this.root.querySelector('#az-body');
      if (!body) return;
      if (this.activeTab === 'arcade') this._renderArcade(body);
      else if (this.activeTab === 'casino') this._renderCasino(body);
      else this._renderLeaderboard(body);
    }

    // ==========================================================
    // ARCADE TAB (Board games)
    // ==========================================================
    _renderArcade(body) {
      const games = [
        { id: 'tictactoe', icon: 'grid', label: 'Tic-Tac-Toe' },
        { id: 'connect4', icon: 'discs', label: '4 Gewinnt' },
        { id: 'chess', icon: 'crown', label: 'Schach' }
      ];
      body.innerHTML = `
        <div class="az-flex-col az-gap-3">
          <div class="az-segmented">
            ${games.map(g => `<button data-game="${g.id}" class="az-flex az-gap-1 ${this.activeBoardGame === g.id ? 'az-active' : ''}">${Icon(g.icon, { size: 15 })}<span>${g.label}</span></button>`).join('')}
          </div>
          <div class="az-flex-between" style="flex-wrap:wrap;gap:8px;">
            <div class="az-segmented" style="max-width:240px;">
              <button data-mode="ai" class="az-flex az-gap-1 ${this.boardMode === 'ai' ? 'az-active' : ''}">${Icon('bot', { size: 14 })}<span>KI</span></button>
              <button data-mode="local" class="az-flex az-gap-1 ${this.boardMode === 'local' ? 'az-active' : ''}">${Icon('users', { size: 14 })}<span>Lokal</span></button>
              <button data-mode="p2p" class="az-flex az-gap-1 ${this.boardMode === 'p2p' ? 'az-active' : ''}" ${this.p2p.isConnected() ? '' : 'disabled'}>${Icon('globe', { size: 14 })}<span>Online</span></button>
            </div>
            <button id="az-board-reset" class="az-btn az-btn-secondary az-btn-sm az-flex az-gap-1">${Icon('refresh', { size: 14 })}<span>Neu</span></button>
          </div>
          <div id="az-board-status" class="az-result-banner"></div>
          <div class="az-board-wrap"><div id="az-board-arena"></div></div>
        </div>`;

      body.querySelectorAll('[data-game]').forEach(btn => btn.onclick = () => {
        this.activeBoardGame = btn.getAttribute('data-game');
        this.resetActiveBoardGame();
        this.render();
      });
      body.querySelectorAll('[data-mode]').forEach(btn => btn.onclick = () => {
        if (btn.disabled) return;
        this.boardMode = btn.getAttribute('data-mode');
        this.resetActiveBoardGame();
        this.render();
      });
      body.querySelector('#az-board-reset').onclick = () => {
        this.resetActiveBoardGame();
        if (this.boardMode === 'p2p') this.p2p.send({ scope: 'board', type: 'RESET' });
        this._renderBody();
      };

      this._renderBoardArena();
    }

    resetActiveBoardGame() {
      if (this.activeBoardGame === 'tictactoe') this.ttt.reset();
      else if (this.activeBoardGame === 'connect4') this.c4.reset();
      else this.chess.reset();
      this.isMyTurn = this.boardMode === 'p2p' ? this.p2p.isHost : true;
    }

    _renderBoardArena() {
      const arena = this.root.querySelector('#az-board-arena');
      const status = this.root.querySelector('#az-board-status');
      if (!arena) return;

      if (this.activeBoardGame === 'tictactoe') {
        arena.innerHTML = `<div class="az-ttt-grid">
          ${this.ttt.board.map((v, i) => {
            const isWin = this.ttt.winningLine && this.ttt.winningLine.includes(i);
            const color = v === 'X' ? 'var(--az-blue)' : 'var(--az-red)';
            return `<div data-i="${i}" class="az-ttt-cell ${isWin ? 'az-win' : ''}" style="color:${color}">${v}</div>`;
          }).join('')}
        </div>`;
        arena.querySelectorAll('[data-i]').forEach(cell => cell.onclick = () => this._playTTT(parseInt(cell.getAttribute('data-i'), 10)));
        status.textContent = this._boardStatusText('ttt');
      } else if (this.activeBoardGame === 'connect4') {
        arena.innerHTML = `<div class="az-c4-wrap">
          <div class="az-c4-drops">${Array(7).fill(0).map((_, c) => `<button data-c="${c}" class="az-c4-drop-btn">▾</button>`).join('')}</div>
          <div class="az-c4-grid">${this.c4.board.flat().map((v) => `<div class="az-c4-cell ${v === 1 ? 'az-p1' : v === 2 ? 'az-p2' : ''}"></div>`).join('')}</div>
        </div>`;
        arena.querySelectorAll('[data-c]').forEach(btn => btn.onclick = () => this._playC4(parseInt(btn.getAttribute('data-c'), 10)));
        status.textContent = this._boardStatusText('c4');
      } else {
        arena.innerHTML = `<div class="az-chess-grid">
          ${this.chess.board.flat().map((p, i) => {
            const r = Math.floor(i / 8), c = i % 8;
            const light = (r + c) % 2 === 0;
            const isSel = this.chess.selected && this.chess.selected.r === r && this.chess.selected.c === c;
            const isValid = this.chess.validMoves.some(m => m.r === r && m.c === c);
            const cls = ['az-chess-cell', light ? 'az-light' : 'az-dark', isSel ? 'az-selected' : '', isValid ? 'az-valid' : '', this.chess.isWhite(p) ? 'az-chess-piece-w' : this.chess.isBlack(p) ? 'az-chess-piece-b' : ''].join(' ');
            return `<div data-r="${r}" data-c="${c}" class="${cls}">${p}</div>`;
          }).join('')}
        </div>`;
        arena.querySelectorAll('[data-r]').forEach(cell => cell.onclick = () => this._playChess(parseInt(cell.getAttribute('data-r'), 10), parseInt(cell.getAttribute('data-c'), 10)));
        status.textContent = this._boardStatusText('chess');
      }
    }

    _boardStatusText(game) {
      if (game === 'ttt') {
        if (this.ttt.winner) return this.ttt.winner === 'TIE' ? 'Unentschieden.' : `${this.ttt.winner} gewinnt.`;
        return this.boardMode === 'p2p' ? (this.isMyTurn ? 'Du bist dran' : 'Gegner ist dran') : `${this.ttt.turn} ist dran`;
      }
      if (game === 'c4') {
        if (this.c4.winner) return this.c4.winner === 'TIE' ? 'Unentschieden.' : `Spieler ${this.c4.winner} gewinnt.`;
        return this.boardMode === 'p2p' ? (this.isMyTurn ? 'Du bist dran' : 'Gegner ist dran') : `Spieler ${this.c4.turn} ist dran`;
      }
      if (this.chess.winner) return `${this.chess.winner} gewinnt.`;
      return this.boardMode === 'p2p' ? (this.isMyTurn ? 'Du bist dran' : 'Gegner ist dran') : (this.chess.turn === 'w' ? 'Weiß ist dran' : 'Schwarz ist dran');
    }

    /** Only AI and Online modes have a well-defined "me" to score; local pass-and-play is shared. */
    _maybeRecordBoard(game, winner, meIsFirstSide) {
      if (this.boardMode === 'local') return;
      if (winner === 'TIE') { this._recordResult(game, 'tie', 0); return; }
      const iAmFirstSide = this.boardMode === 'ai' ? true : this.p2p.isHost;
      const iWon = meIsFirstSide === iAmFirstSide;
      this._recordResult(game, iWon ? 'win' : 'lose', 0);
    }

    _playTTT(i, fromRemote = false) {
      if (this.ttt.winner) return;
      if (this.boardMode === 'p2p' && !fromRemote && !this.isMyTurn) return;
      if (!this.ttt.move(i)) return;
      this.sound.play('move');
      if (this.boardMode === 'p2p' && !fromRemote) { this.p2p.send({ scope: 'board', type: 'MOVE', game: 'ttt', i }); this.isMyTurn = false; }
      else if (this.boardMode === 'p2p' && fromRemote) this.isMyTurn = true;
      this._renderBoardArena();
      if (this.ttt.winner) {
        this.sound.play(this.ttt.winner === 'TIE' ? 'click' : 'win');
        this._maybeRecordBoard('tictactoe', this.ttt.winner, this.ttt.winner === 'X');
        return;
      }
      if (this.boardMode === 'ai' && this.ttt.turn === 'O') {
        setTimeout(() => {
          const ai = this.ttt.getAIMove('hard');
          if (ai !== null) {
            this.ttt.move(ai); this.sound.play('move'); this._renderBoardArena();
            if (this.ttt.winner) { this.sound.play(this.ttt.winner === 'TIE' ? 'click' : 'lose'); this._maybeRecordBoard('tictactoe', this.ttt.winner, this.ttt.winner === 'X'); }
          }
        }, 350);
      }
    }

    _playC4(col, fromRemote = false) {
      if (this.c4.winner) return;
      if (this.boardMode === 'p2p' && !fromRemote && !this.isMyTurn) return;
      if (this.c4.drop(col) === null) return;
      this.sound.play('move');
      if (this.boardMode === 'p2p' && !fromRemote) { this.p2p.send({ scope: 'board', type: 'MOVE', game: 'c4', col }); this.isMyTurn = false; }
      else if (this.boardMode === 'p2p' && fromRemote) this.isMyTurn = true;
      this._renderBoardArena();
      if (this.c4.winner) {
        this.sound.play(this.c4.winner === 'TIE' ? 'click' : 'win');
        this._maybeRecordBoard('connect4', this.c4.winner, this.c4.winner === 1);
        return;
      }
      if (this.boardMode === 'ai' && this.c4.turn === 2) {
        setTimeout(() => {
          const ai = this.c4.getAIMove();
          if (ai !== null) {
            this.c4.drop(ai); this.sound.play('move'); this._renderBoardArena();
            if (this.c4.winner) { this.sound.play(this.c4.winner === 'TIE' ? 'click' : 'lose'); this._maybeRecordBoard('connect4', this.c4.winner, this.c4.winner === 1); }
          }
        }, 350);
      }
    }

    _playChess(r, c, fromRemote = false, fromR = null, fromC = null) {
      if (this.chess.winner) return;
      if (this.boardMode === 'p2p' && !fromRemote && !this.isMyTurn) return;
      if (fromRemote) {
        this.chess.move(fromR, fromC, r, c);
        this.isMyTurn = true;
        this._renderBoardArena();
        if (this.chess.winner) { this.sound.play('win'); this._maybeRecordBoard('chess', this.chess.winner, this.chess.winner === 'White'); }
        return;
      }
      if (this.chess.selected && this.chess.validMoves.some(m => m.r === r && m.c === c)) {
        const from = this.chess.selected;
        this.chess.move(from.r, from.c, r, c);
        this.sound.play('move');
        if (this.boardMode === 'p2p') { this.p2p.send({ scope: 'board', type: 'MOVE', game: 'chess', fromR: from.r, fromC: from.c, r, c }); this.isMyTurn = false; }
        this._renderBoardArena();
        if (this.chess.winner) { this.sound.play('win'); this._maybeRecordBoard('chess', this.chess.winner, this.chess.winner === 'White'); return; }
        if (this.boardMode === 'ai' && this.chess.turn === 'b') {
          setTimeout(() => {
            const m = this.chess.getAIMove();
            if (m) {
              this.chess.move(m.from.r, m.from.c, m.to.r, m.to.c); this.sound.play('move'); this._renderBoardArena();
              if (this.chess.winner) { this.sound.play('lose'); this._maybeRecordBoard('chess', this.chess.winner, this.chess.winner === 'White'); }
            }
          }, 400);
        }
      } else {
        const p = this.chess.board[r][c];
        if (p && ((this.chess.isWhite(p) && this.chess.turn === 'w') || (this.chess.isBlack(p) && this.chess.turn === 'b'))) {
          this.chess.selected = { r, c };
          this.chess.validMoves = this.chess.getValidMoves(r, c);
        } else {
          this.chess.selected = null;
          this.chess.validMoves = [];
        }
        this._renderBoardArena();
      }
    }

    _handleBoardData(data) {
      if (data.type === 'RESET') { this.resetActiveBoardGame(); this._renderBody(); return; }
      if (data.type !== 'MOVE') return;
      if (data.game === 'ttt') this._playTTT(data.i, true);
      else if (data.game === 'c4') this._playC4(data.col, true);
      else if (data.game === 'chess') this._playChess(data.r, data.c, true, data.fromR, data.fromC);
    }

    // ==========================================================
    // CASINO TAB
    // ==========================================================
    _renderCasino(body) {
      if (this.activeCasinoGame) { this._renderCasinoGame(body); return; }
      body.innerHTML = `
        <div class="az-flex-col az-gap-3">
          <div class="az-flex-between az-card" style="background:rgba(255,204,0,0.12);">
            <span class="az-flex az-gap-1 az-text-headline">${Icon('wallet', { size: 16 })}<span>Guthaben</span></span>
            <span class="az-badge az-badge-gold" data-wallet-badge>${this.wallet.balance.toLocaleString('de-DE')}</span>
          </div>
          <div class="az-grid-3">
            ${window.CASINO_GAMES.map(g => `<div class="az-game-tile" data-casino="${g.id}">${Icon(g.icon, { size: 22 })}<div class="az-tile-label">${g.title}</div></div>`).join('')}
          </div>
          <div class="az-text-footnote" style="text-align:center;">Virtuelle Coins zum Spaß — kein Echtgeld, kein Server.</div>
        </div>`;
      body.querySelectorAll('[data-casino]').forEach(tile => tile.onclick = () => {
        this.activeCasinoGame = tile.getAttribute('data-casino');
        this.render();
      });
    }

    _renderCasinoGame(body) {
      const game = window.CASINO_GAMES.find(g => g.id === this.activeCasinoGame);
      body.innerHTML = `
        <div class="az-flex-col az-gap-3">
          <div class="az-flex-between">
            <button id="az-casino-back" class="az-btn az-btn-plain az-flex az-gap-1">${Icon('chevronLeft', { size: 15 })}<span>Zurück</span></button>
            <span class="az-badge az-badge-gold" data-wallet-badge>${this.wallet.balance.toLocaleString('de-DE')}</span>
          </div>
          <div class="az-flex az-gap-2" style="justify-content:center;align-items:center;">${Icon(game.icon, { size: 20 })}<span class="az-text-title3">${game.title}</span></div>
          <div id="az-casino-panel"></div>
        </div>`;
      body.querySelector('#az-casino-back').onclick = () => {
        this.casinoDuelHandler = null;
        this.activeCasinoGame = null;
        this.render();
      };

      const ctx = {
        wallet: this.wallet,
        playSound: (n) => this.sound.play(n),
        recordResult: (result, delta) => this._recordResult(game.id, result, delta),
        duel: {
          isConnected: () => this.p2p.isConnected(),
          isHost: () => this.p2p.isHost,
          send: (type, payload) => this.p2p.send(Object.assign({ scope: 'casino', type }, payload)),
          setHandler: (fn) => { this.casinoDuelHandler = fn; },
          clearHandler: () => { this.casinoDuelHandler = null; }
        }
      };
      game.render(body.querySelector('#az-casino-panel'), ctx);
    }

    // ==========================================================
    // LEADERBOARD / NETWORK TAB
    // ==========================================================
    _renderLeaderboard(body) {
      if (!this.ledger) {
        body.innerHTML = `<div class="az-text-footnote" style="text-align:center;">Lade lokales Klassenbuch…</div>`;
        return;
      }
      const rows = this.network.buildLeaderboard(this.ledger.deviceId);
      body.innerHTML = `
        <div class="az-flex-col az-gap-3">
          <div class="az-card az-flex-col az-gap-1">
            <span class="az-flex az-gap-1 az-text-headline">${Icon('link', { size: 15 })}<span>Dein Netzwerk</span></span>
            <span class="az-text-footnote">
              ${rows.length} bekannte Geräte · ${this.ledger.chain.length} eigene Blöcke.
              Jede Online-Verbindung tauscht euer gesamtes bekanntes Netzwerk aus — so wächst deine Rangliste mit jedem neuen Kontakt, ganz ohne Server.
            </span>
          </div>
          <div class="az-flex-col az-gap-2">
            ${rows.length === 0
              ? `<div class="az-text-footnote" style="text-align:center;">Noch keine Ergebnisse — spiel eine Runde Arcade oder Casino.</div>`
              : rows.map((r, i) => `
                <div class="az-leaderboard-row ${r.isMe ? 'az-me' : ''}">
                  <div class="az-lb-rank">${i + 1}</div>
                  <div class="az-lb-info">
                    <div class="az-lb-name">${r.name}${r.isMe ? ' (Du)' : ''}</div>
                    <div class="az-lb-meta">${r.fingerprint} · ${r.blocks} Blöcke · ${r.wins}S/${r.losses}N</div>
                  </div>
                  <div class="az-lb-score ${r.netCoins > 0 ? 'az-positive' : r.netCoins < 0 ? 'az-negative' : ''}">${r.netCoins > 0 ? '+' : ''}${r.netCoins}</div>
                </div>`).join('')}
          </div>
        </div>`;
    }
  }

  root.ArcadeApp = ArcadeApp;
})(typeof window !== 'undefined' ? window : globalThis);
