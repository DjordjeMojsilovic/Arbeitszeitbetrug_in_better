// ==UserScript==
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
// Source of truth: src/**/*.js — run `node build/build_userscript.js` to regenerate.

(function () {
'use strict';

// ---- src/core/cards.js ----
/**
 * Shared card-deck utilities used by Blackjack, Video Poker, Baccarat and Higher/Lower.
 */
(function (root) {
  'use strict';

  const SUITS = ['♠', '♥', '♦', '♣'];
  const RED_SUITS = ['♥', '♦'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  function createShoe(deckCount = 1) {
    const cards = [];
    for (let d = 0; d < deckCount; d++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          cards.push({ suit, rank, red: RED_SUITS.includes(suit) });
        }
      }
    }
    return shuffle(cards);
  }

  function shuffle(cards) {
    const arr = cards.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function cardLabel(card) {
    return `${card.rank}${card.suit}`;
  }

  function rankValue(rank) {
    if (rank === 'A') return 14;
    if (rank === 'K') return 13;
    if (rank === 'Q') return 12;
    if (rank === 'J') return 11;
    return parseInt(rank, 10);
  }

  function blackjackValue(hand) {
    let total = 0;
    let aces = 0;
    for (const c of hand) {
      if (c.rank === 'A') { total += 11; aces++; }
      else if (['J', 'Q', 'K'].includes(c.rank)) total += 10;
      else total += parseInt(c.rank, 10);
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }

  root.CardDeck = { createShoe, shuffle, cardLabel, rankValue, blackjackValue, SUITS, RANKS };
})(typeof window !== 'undefined' ? window : globalThis);

// ---- src/core/wallet.js ----
/**
 * Casino wallet: one shared virtual coin balance across all casino games.
 * Persists via chrome.storage.local when running as an extension, otherwise
 * falls back to localStorage. No server, no database — fully peer-local.
 */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'arcade_casino_wallet_v1';
  const START_BALANCE = 500;

  class CasinoWallet {
    constructor() {
      this.balance = START_BALANCE;
      this.listeners = [];
      this._load();
    }

    onChange(fn) { this.listeners.push(fn); }

    _notify() { this.listeners.forEach(fn => { try { fn(this.balance); } catch (e) {} }); }

    _load() {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([STORAGE_KEY], (res) => {
          if (res && typeof res[STORAGE_KEY] === 'number') {
            this.balance = res[STORAGE_KEY];
            this._notify();
          }
        });
      } else {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw !== null) this.balance = parseInt(raw, 10) || START_BALANCE;
        } catch (e) {}
      }
    }

    _save() {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [STORAGE_KEY]: this.balance });
      } else {
        try { localStorage.setItem(STORAGE_KEY, String(this.balance)); } catch (e) {}
      }
    }

    canAfford(amount) { return this.balance >= amount; }

    place(amount) {
      if (amount <= 0 || amount > this.balance) return false;
      this.balance -= amount;
      this._save();
      this._notify();
      return true;
    }

    award(amount) {
      this.balance += amount;
      this._save();
      this._notify();
    }

    reset() {
      this.balance = START_BALANCE;
      this._save();
      this._notify();
    }
  }

  root.CasinoWallet = CasinoWallet;
})(typeof window !== 'undefined' ? window : globalThis);

// ---- src/core/board-games.js ----
/**
 * Board game engines: Tic-Tac-Toe, Connect 4, Chess.
 * Pure logic, no DOM access — shared by extension, userscript and web app.
 */
(function (root) {
  'use strict';

  class TicTacToeEngine {
    constructor() { this.reset(); }
    reset() {
      this.board = Array(9).fill('');
      this.turn = 'X';
      this.winner = null;
      this.winningLine = null;
    }
    move(i) {
      if (i < 0 || i > 8 || this.board[i] || this.winner) return false;
      this.board[i] = this.turn;
      const line = this.checkWin(this.turn);
      if (line) {
        this.winner = this.turn;
        this.winningLine = line;
      } else if (!this.board.includes('')) {
        this.winner = 'TIE';
      } else {
        this.turn = this.turn === 'X' ? 'O' : 'X';
      }
      return true;
    }
    checkWin(sym) {
      const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
      ];
      for (const l of lines) {
        if (this.board[l[0]] === sym && this.board[l[1]] === sym && this.board[l[2]] === sym) return l;
      }
      return null;
    }
    getAIMove(difficulty = 'hard') {
      const avail = [];
      for (let i = 0; i < 9; i++) if (!this.board[i]) avail.push(i);
      if (!avail.length || this.winner) return null;
      if (difficulty === 'easy' && Math.random() < 0.6) {
        return avail[Math.floor(Math.random() * avail.length)];
      }
      for (const i of avail) {
        this.board[i] = 'O';
        if (this.checkWin('O')) { this.board[i] = ''; return i; }
        this.board[i] = '';
      }
      for (const i of avail) {
        this.board[i] = 'X';
        if (this.checkWin('X')) { this.board[i] = ''; return i; }
        this.board[i] = '';
      }
      return avail[Math.floor(Math.random() * avail.length)];
    }
  }

  class Connect4Engine {
    constructor() { this.reset(); }
    reset() {
      this.board = Array(6).fill(null).map(() => Array(7).fill(0));
      this.turn = 1;
      this.winner = null;
      this.winningCoords = null;
    }
    drop(col) {
      if (col < 0 || col >= 7 || this.winner) return null;
      let row = -1;
      for (let r = 5; r >= 0; r--) if (this.board[r][col] === 0) { row = r; break; }
      if (row === -1) return null;
      this.board[row][col] = this.turn;
      const win = this.checkWin(this.board);
      if (win) {
        this.winner = this.turn;
        this.winningCoords = win;
      } else if (this.board.every(row => row.every(cell => cell !== 0))) {
        this.winner = 'TIE';
      } else {
        this.turn = this.turn === 1 ? 2 : 1;
      }
      return row;
    }
    checkWin(g) {
      for (let r = 0; r < 6; r++) for (let c = 0; c <= 3; c++)
        if (g[r][c] && g[r][c] === g[r][c + 1] && g[r][c] === g[r][c + 2] && g[r][c] === g[r][c + 3])
          return [{ r, c }, { r, c: c + 1 }, { r, c: c + 2 }, { r, c: c + 3 }];
      for (let r = 0; r <= 2; r++) for (let c = 0; c < 7; c++)
        if (g[r][c] && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 2][c] && g[r][c] === g[r + 3][c])
          return [{ r, c }, { r: r + 1, c }, { r: r + 2, c }, { r: r + 3, c }];
      for (let r = 0; r <= 2; r++) for (let c = 0; c <= 3; c++)
        if (g[r][c] && g[r][c] === g[r + 1][c + 1] && g[r][c] === g[r + 2][c + 2] && g[r][c] === g[r + 3][c + 3])
          return [{ r, c }, { r: r + 1, c: c + 1 }, { r: r + 2, c: c + 2 }, { r: r + 3, c: c + 3 }];
      for (let r = 3; r < 6; r++) for (let c = 0; c <= 3; c++)
        if (g[r][c] && g[r][c] === g[r - 1][c + 1] && g[r][c] === g[r - 2][c + 2] && g[r][c] === g[r - 3][c + 3])
          return [{ r, c }, { r: r - 1, c: c + 1 }, { r: r - 2, c: c + 2 }, { r: r - 3, c: c + 3 }];
      return null;
    }
    getAIMove() {
      const valid = [];
      for (let c = 0; c < 7; c++) if (this.board[0][c] === 0) valid.push(c);
      if (!valid.length || this.winner) return null;
      return valid[Math.floor(Math.random() * valid.length)];
    }
  }

  class ChessEngine {
    constructor() { this.reset(); }
    reset() {
      this.board = [
        ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
        ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
        ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
      ];
      this.turn = 'w';
      this.selected = null;
      this.validMoves = [];
      this.winner = null;
      this.lastMovedTo = null;
      this.wKingMoved = false;
      this.wRook0Moved = false;
      this.wRook7Moved = false;
      this.bKingMoved = false;
      this.bRook0Moved = false;
      this.bRook7Moved = false;
    }
    isWhite(p) { return '♙♖♘♗♕♔'.includes(p); }
    isBlack(p) { return '♟♜♞♝♛♚'.includes(p); }
    getValidMoves(r, c) {
      const p = this.board[r][c];
      if (!p) return [];
      const isW = this.isWhite(p);
      if ((isW && this.turn !== 'w') || (!isW && this.turn !== 'b')) return [];
      const moves = [];
      const addMove = (tr, tc) => {
        if (tr < 0 || tr > 7 || tc < 0 || tc > 7) return false;
        const target = this.board[tr][tc];
        if (!target) { moves.push({ r: tr, c: tc }); return true; }
        if ((isW && this.isBlack(target)) || (!isW && this.isWhite(target))) moves.push({ r: tr, c: tc });
        return false;
      };
      if (p === '♙') {
        if (r > 0 && this.board[r - 1][c] === '') {
          moves.push({ r: r - 1, c });
          if (r === 6 && this.board[r - 2][c] === '') moves.push({ r: r - 2, c });
        }
        if (r > 0 && c > 0 && this.board[r - 1][c - 1] !== '' && this.isBlack(this.board[r - 1][c - 1])) moves.push({ r: r - 1, c: c - 1 });
        if (r > 0 && c < 7 && this.board[r - 1][c + 1] !== '' && this.isBlack(this.board[r - 1][c + 1])) moves.push({ r: r - 1, c: c + 1 });
      } else if (p === '♟') {
        if (r < 7 && this.board[r + 1][c] === '') {
          moves.push({ r: r + 1, c });
          if (r === 1 && this.board[r + 2][c] === '') moves.push({ r: r + 2, c });
        }
        if (r < 7 && c > 0 && this.board[r + 1][c - 1] !== '' && this.isWhite(this.board[r + 1][c - 1])) moves.push({ r: r + 1, c: c - 1 });
        if (r < 7 && c < 7 && this.board[r + 1][c + 1] !== '' && this.isWhite(this.board[r + 1][c + 1])) moves.push({ r: r + 1, c: c + 1 });
      } else if (p === '♘' || p === '♞') {
        const deltas = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
        for (const [dr, dc] of deltas) addMove(r + dr, c + dc);
      } else if (p === '♔') {
        const deltas = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
        for (const [dr, dc] of deltas) addMove(r + dr, c + dc);
        if (!this.wKingMoved && r === 7 && c === 4) {
          if (!this.wRook7Moved && this.board[7][5] === '' && this.board[7][6] === '' && this.board[7][7] === '♖') moves.push({ r: 7, c: 6, castle: 'K' });
          if (!this.wRook0Moved && this.board[7][1] === '' && this.board[7][2] === '' && this.board[7][3] === '' && this.board[7][0] === '♖') moves.push({ r: 7, c: 2, castle: 'Q' });
        }
      } else if (p === '♚') {
        const deltas = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
        for (const [dr, dc] of deltas) addMove(r + dr, c + dc);
        if (!this.bKingMoved && r === 0 && c === 4) {
          if (!this.bRook7Moved && this.board[0][5] === '' && this.board[0][6] === '' && this.board[0][7] === '♜') moves.push({ r: 0, c: 6, castle: 'K' });
          if (!this.bRook0Moved && this.board[0][1] === '' && this.board[0][2] === '' && this.board[0][3] === '' && this.board[0][0] === '♜') moves.push({ r: 0, c: 2, castle: 'Q' });
        }
      }
      if ('♖♜♕♛'.includes(p)) {
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of dirs) { let tr = r + dr, tc = c + dc; while (addMove(tr, tc)) { tr += dr; tc += dc; } }
      }
      if ('♗♝♕♛'.includes(p)) {
        const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (const [dr, dc] of dirs) { let tr = r + dr, tc = c + dc; while (addMove(tr, tc)) { tr += dr; tc += dc; } }
      }
      return moves;
    }
    move(fromR, fromC, toR, toC) {
      const p = this.board[fromR][fromC];
      const target = this.board[toR][toC];
      const valid = this.getValidMoves(fromR, fromC);
      const match = valid.find(m => m.r === toR && m.c === toC);
      if (!match) return false;
      if (match.castle === 'K') {
        this.board[toR][toC] = p; this.board[fromR][fromC] = '';
        this.board[toR][5] = this.board[toR][7]; this.board[toR][7] = '';
      } else if (match.castle === 'Q') {
        this.board[toR][toC] = p; this.board[fromR][fromC] = '';
        this.board[toR][3] = this.board[toR][0]; this.board[toR][0] = '';
      } else {
        this.board[toR][toC] = p; this.board[fromR][fromC] = '';
      }
      this.lastMovedTo = { r: toR, c: toC };
      if (p === '♔') this.wKingMoved = true;
      if (p === '♚') this.bKingMoved = true;
      if (fromR === 7 && fromC === 0) this.wRook0Moved = true;
      if (fromR === 7 && fromC === 7) this.wRook7Moved = true;
      if (fromR === 0 && fromC === 0) this.bRook0Moved = true;
      if (fromR === 0 && fromC === 7) this.bRook7Moved = true;
      if (target === '♔' || target === '♚') this.winner = this.turn === 'w' ? 'White' : 'Black';
      this.turn = this.turn === 'w' ? 'b' : 'w';
      this.selected = null;
      this.validMoves = [];
      return true;
    }
    getAIMove() {
      if (this.winner || this.turn !== 'b') return null;
      const allMoves = [];
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        if (this.isBlack(this.board[r][c])) {
          for (const m of this.getValidMoves(r, c)) {
            allMoves.push({ from: { r, c }, to: m, isCapture: !!this.board[m.r][m.c] });
          }
        }
      }
      if (!allMoves.length) return null;
      const captures = allMoves.filter(m => m.isCapture);
      if (captures.length) return captures[Math.floor(Math.random() * captures.length)];
      return allMoves[Math.floor(Math.random() * allMoves.length)];
    }
  }

  root.TicTacToeEngine = TicTacToeEngine;
  root.Connect4Engine = Connect4Engine;
  root.ChessEngine = ChessEngine;
})(typeof window !== 'undefined' ? window : globalThis);

// ---- src/core/casino-games.js ----
/**
 * Casino game engines. Every engine is pure logic (no DOM), returns plain
 * result objects that the UI layer renders and animates. All randomness is
 * local (Math.random) — there is no server or database involved.
 */
(function (root) {
  'use strict';

  const Cards = root.CardDeck;

  function randInt(maxExclusive) { return Math.floor(Math.random() * maxExclusive); }
  function pick(arr) { return arr[randInt(arr.length)]; }

  // ==========================================================
  // 1. SLOT MACHINE
  // ==========================================================
  class SlotMachineEngine {
    constructor() {
      this.symbols = ['💼', '🍒', '💰', '💎', '7️⃣', '🚀'];
    }
    spin(bet) {
      const reels = [pick(this.symbols), pick(this.symbols), pick(this.symbols)];
      let payout = 0;
      let label = '';
      if (reels[0] === reels[1] && reels[1] === reels[2]) {
        const jackpotSymbols = ['💎', '7️⃣'];
        payout = jackpotSymbols.includes(reels[0]) ? bet * 50 : bet * 20;
        label = jackpotSymbols.includes(reels[0]) ? 'JACKPOT' : 'BIG WIN';
      } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
        payout = bet * 3;
        label = 'MINI WIN';
      }
      return { reels, payout, win: payout > 0, label };
    }
  }

  // ==========================================================
  // 2. BLACKJACK
  // ==========================================================
  class BlackjackEngine {
    constructor() { this.reset(); }
    reset() {
      this.deck = [];
      this.playerHand = [];
      this.dealerHand = [];
      this.phase = 'idle'; // idle -> playing -> dealer -> done
      this.result = null;
      this.bet = 0;
    }
    deal(bet) {
      this.deck = Cards.createShoe(2);
      this.playerHand = [this.deck.pop(), this.deck.pop()];
      this.dealerHand = [this.deck.pop(), this.deck.pop()];
      this.bet = bet;
      this.result = null;
      this.phase = 'playing';
      if (Cards.blackjackValue(this.playerHand) === 21) {
        this.phase = 'dealer';
        return this.resolveDealer();
      }
      return { phase: this.phase };
    }
    hit() {
      if (this.phase !== 'playing') return null;
      this.playerHand.push(this.deck.pop());
      const value = Cards.blackjackValue(this.playerHand);
      if (value > 21) {
        this.phase = 'done';
        this.result = { outcome: 'bust', payout: 0 };
        return this.result;
      }
      return { phase: this.phase, value };
    }
    stand() {
      if (this.phase !== 'playing') return null;
      this.phase = 'dealer';
      return this.resolveDealer();
    }
    resolveDealer() {
      while (Cards.blackjackValue(this.dealerHand) < 17) {
        this.dealerHand.push(this.deck.pop());
      }
      const playerValue = Cards.blackjackValue(this.playerHand);
      const dealerValue = Cards.blackjackValue(this.dealerHand);
      const playerBJ = playerValue === 21 && this.playerHand.length === 2;
      const dealerBJ = dealerValue === 21 && this.dealerHand.length === 2;
      let outcome, payout;
      if (dealerValue > 21) { outcome = 'dealer_bust'; payout = this.bet * 2; }
      else if (playerBJ && !dealerBJ) { outcome = 'blackjack'; payout = Math.floor(this.bet * 2.5); }
      else if (dealerBJ && !playerBJ) { outcome = 'dealer_blackjack'; payout = 0; }
      else if (playerValue > dealerValue) { outcome = 'win'; payout = this.bet * 2; }
      else if (playerValue < dealerValue) { outcome = 'lose'; payout = 0; }
      else { outcome = 'push'; payout = this.bet; }
      this.phase = 'done';
      this.result = { outcome, payout, playerValue, dealerValue };
      return this.result;
    }
  }

  // ==========================================================
  // 3. ROULETTE (European, single zero)
  // ==========================================================
  class RouletteEngine {
    constructor() {
      this.redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
    }
    colorOf(n) { if (n === 0) return 'green'; return this.redNumbers.has(n) ? 'red' : 'black'; }
    spin(betType, betValue, amount) {
      const number = randInt(37);
      const color = this.colorOf(number);
      let win = false;
      let multiplier = 0;
      switch (betType) {
        case 'straight': win = number === betValue; multiplier = 36; break;
        case 'color': win = color === betValue; multiplier = 2; break;
        case 'parity': win = number !== 0 && (number % 2 === 0 ? 'even' : 'odd') === betValue; multiplier = 2; break;
        case 'half': win = number !== 0 && (betValue === 'low' ? number <= 18 : number >= 19); multiplier = 2; break;
        case 'dozen': {
          const d = betValue; // 1, 2, 3
          win = number !== 0 && Math.ceil(number / 12) === d;
          multiplier = 3;
          break;
        }
      }
      const payout = win ? amount * multiplier : 0;
      return { number, color, win, payout };
    }
  }

  // ==========================================================
  // 4. VIDEO POKER (Jacks or Better)
  // ==========================================================
  class VideoPokerEngine {
    constructor() { this.reset(); }
    reset() {
      this.deck = [];
      this.hand = [];
      this.phase = 'idle'; // idle -> held -> done
      this.bet = 0;
    }
    deal(bet) {
      this.deck = Cards.createShoe(1);
      this.hand = [this.deck.pop(), this.deck.pop(), this.deck.pop(), this.deck.pop(), this.deck.pop()];
      this.bet = bet;
      this.phase = 'held';
      return this.hand;
    }
    draw(holdIndices) {
      for (let i = 0; i < 5; i++) {
        if (!holdIndices.includes(i)) this.hand[i] = this.deck.pop();
      }
      this.phase = 'done';
      const rank = this.evaluate(this.hand);
      const table = {
        'royal_flush': 250, 'straight_flush': 50, 'four_kind': 25, 'full_house': 9,
        'flush': 6, 'straight': 4, 'three_kind': 3, 'two_pair': 2, 'jacks_or_better': 1, 'nothing': 0
      };
      const multiplier = table[rank.name] || 0;
      const payout = this.bet * multiplier;
      return { hand: this.hand, rank, payout, win: payout > 0 };
    }
    evaluate(hand) {
      const values = hand.map(c => Cards.rankValue(c.rank)).sort((a, b) => a - b);
      const suits = hand.map(c => c.suit);
      const isFlush = suits.every(s => s === suits[0]);
      const uniqueVals = [...new Set(values)];
      const isStraight = uniqueVals.length === 5 && (values[4] - values[0] === 4 ||
        (values.join(',') === '2,3,4,5,14')); // wheel straight (A-2-3-4-5)
      const counts = {};
      values.forEach(v => counts[v] = (counts[v] || 0) + 1);
      const countValues = Object.values(counts).sort((a, b) => b - a);

      if (isFlush && isStraight && values[0] === 10) return { name: 'royal_flush', label: 'Royal Flush' };
      if (isFlush && isStraight) return { name: 'straight_flush', label: 'Straight Flush' };
      if (countValues[0] === 4) return { name: 'four_kind', label: 'Vierling' };
      if (countValues[0] === 3 && countValues[1] === 2) return { name: 'full_house', label: 'Full House' };
      if (isFlush) return { name: 'flush', label: 'Flush' };
      if (isStraight) return { name: 'straight', label: 'Straße' };
      if (countValues[0] === 3) return { name: 'three_kind', label: 'Drilling' };
      if (countValues[0] === 2 && countValues[1] === 2) return { name: 'two_pair', label: 'Zwei Paare' };
      if (countValues[0] === 2) {
        const pairValue = Object.keys(counts).find(k => counts[k] === 2);
        if (parseInt(pairValue, 10) >= 11) return { name: 'jacks_or_better', label: 'Bube oder besser' };
      }
      return { name: 'nothing', label: 'Nichts' };
    }
  }

  // ==========================================================
  // 5. BACCARAT
  // ==========================================================
  class BaccaratEngine {
    baccaratValue(hand) {
      let total = 0;
      for (const c of hand) {
        if (['J', 'Q', 'K', '10'].includes(c.rank)) total += 0;
        else if (c.rank === 'A') total += 1;
        else total += parseInt(c.rank, 10);
      }
      return total % 10;
    }
    play(betOn, amount) {
      const deck = Cards.createShoe(1);
      const player = [deck.pop(), deck.pop()];
      const banker = [deck.pop(), deck.pop()];
      let playerTotal = this.baccaratValue(player);
      let bankerTotal = this.baccaratValue(banker);

      const naturalWin = playerTotal >= 8 || bankerTotal >= 8;
      if (!naturalWin) {
        let playerThird = null;
        if (playerTotal <= 5) {
          playerThird = deck.pop();
          player.push(playerThird);
          playerTotal = this.baccaratValue(player);
        }
        const bankerDraws = () => {
          if (playerThird === null) return bankerTotal <= 5;
          const v = Cards.rankValue(playerThird.rank) === 14 ? 1 : (Cards.rankValue(playerThird.rank) >= 10 ? 0 : Cards.rankValue(playerThird.rank));
          if (bankerTotal <= 2) return true;
          if (bankerTotal === 3) return v !== 8;
          if (bankerTotal === 4) return v >= 2 && v <= 7;
          if (bankerTotal === 5) return v >= 4 && v <= 7;
          if (bankerTotal === 6) return v === 6 || v === 7;
          return false;
        };
        if (bankerDraws()) {
          banker.push(deck.pop());
          bankerTotal = this.baccaratValue(banker);
        }
      }

      let winner;
      if (playerTotal > bankerTotal) winner = 'player';
      else if (bankerTotal > playerTotal) winner = 'banker';
      else winner = 'tie';

      let payout = 0;
      if (betOn === winner) {
        if (winner === 'banker') payout = Math.floor(amount * 1.95);
        else if (winner === 'player') payout = amount * 2;
        else payout = amount * 9;
      } else if (winner === 'tie' && betOn !== 'tie') {
        payout = amount; // push on tie for player/banker bets
      }

      return { player, banker, playerTotal, bankerTotal, winner, payout, win: payout > amount || (winner === 'tie' && betOn !== 'tie') || (betOn === winner) };
    }
  }

  // ==========================================================
  // 6. CRAPS (simplified Pass Line)
  // ==========================================================
  class CrapsEngine {
    constructor() { this.reset(); }
    reset() { this.point = null; this.phase = 'come_out'; this.bet = 0; }
    rollDice() { return [1 + randInt(6), 1 + randInt(6)]; }
    start(bet) {
      this.bet = bet;
      this.phase = 'come_out';
      return this.roll();
    }
    roll() {
      const dice = this.rollDice();
      const sum = dice[0] + dice[1];
      if (this.phase === 'come_out') {
        if (sum === 7 || sum === 11) return { dice, sum, done: true, outcome: 'win', payout: this.bet * 2 };
        if (sum === 2 || sum === 3 || sum === 12) return { dice, sum, done: true, outcome: 'lose', payout: 0 };
        this.point = sum;
        this.phase = 'point';
        return { dice, sum, done: false, point: this.point };
      }
      if (sum === this.point) return { dice, sum, done: true, outcome: 'win', payout: this.bet * 2 };
      if (sum === 7) return { dice, sum, done: true, outcome: 'lose', payout: 0 };
      return { dice, sum, done: false, point: this.point };
    }
    // 1v1 duel: both peers roll two dice, higher sum wins the pot.
    static duelRoll() {
      const dice = [1 + randInt(6), 1 + randInt(6)];
      return { dice, sum: dice[0] + dice[1] };
    }
  }

  // ==========================================================
  // 7. SIC BO
  // ==========================================================
  class SicBoEngine {
    roll(betType, betValue, amount) {
      const dice = [1 + randInt(6), 1 + randInt(6), 1 + randInt(6)];
      const sum = dice[0] + dice[1] + dice[2];
      const isTriple = dice[0] === dice[1] && dice[1] === dice[2];
      let win = false;
      let multiplier = 0;

      switch (betType) {
        case 'big': win = !isTriple && sum >= 11 && sum <= 17; multiplier = 2; break;
        case 'small': win = !isTriple && sum >= 4 && sum <= 10; multiplier = 2; break;
        case 'specific_triple': win = isTriple && dice[0] === betValue; multiplier = 180; break;
        case 'any_triple': win = isTriple; multiplier = 30; break;
        case 'total': win = sum === betValue; multiplier = { 4: 60, 17: 60, 5: 30, 16: 30, 6: 17, 15: 17, 7: 12, 14: 12, 8: 8, 13: 8, 9: 6, 12: 6, 10: 6, 11: 6 }[betValue] || 6; break;
      }

      const payout = win ? amount * multiplier : 0;
      return { dice, sum, isTriple, win, payout };
    }
  }

  // ==========================================================
  // 8. HIGHER OR LOWER
  // ==========================================================
  class HigherLowerEngine {
    constructor() { this.reset(); }
    reset() { this.deck = []; this.current = null; this.streak = 0; this.bet = 0; this.phase = 'idle'; }
    start(bet) {
      this.deck = Cards.createShoe(1);
      this.current = this.deck.pop();
      this.streak = 0;
      this.bet = bet;
      this.phase = 'playing';
      return { card: this.current };
    }
    guess(direction) {
      if (this.phase !== 'playing') return null;
      const next = this.deck.pop();
      const curVal = Cards.rankValue(this.current.rank);
      const nextVal = Cards.rankValue(next.rank);
      let correct;
      if (nextVal === curVal) correct = false; // tie counts as loss to keep odds honest
      else correct = direction === 'higher' ? nextVal > curVal : nextVal < curVal;

      this.current = next;
      if (correct) {
        this.streak++;
        const multiplier = 1 + this.streak * 0.5;
        return { card: next, correct: true, streak: this.streak, currentPayout: Math.floor(this.bet * multiplier) };
      }
      this.phase = 'done';
      return { card: next, correct: false, streak: this.streak, payout: 0 };
    }
    cashOut() {
      if (this.phase !== 'playing') return null;
      const multiplier = 1 + this.streak * 0.5;
      const payout = Math.floor(this.bet * multiplier);
      this.phase = 'done';
      return { payout, streak: this.streak };
    }
  }

  // ==========================================================
  // 9. COIN FLIP
  // ==========================================================
  class CoinFlipEngine {
    flip(call, amount) {
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const win = result === call;
      return { result, win, payout: win ? amount * 2 : 0 };
    }
    // 1v1 duel: host flips, both calls compared; correct caller (or first if both) wins pot.
    static duelFlip() {
      return Math.random() < 0.5 ? 'heads' : 'tails';
    }
  }

  // ==========================================================
  // 10. PLINKO
  // ==========================================================
  class PlinkoEngine {
    constructor(rows = 12) {
      this.rows = rows;
      this.multipliers = {
        low: [1.5, 1.2, 1.1, 1.0, 0.5, 0.3, 0.5, 1.0, 1.1, 1.2, 1.5],
        medium: [3, 2, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 2, 3],
        high: [10, 5, 2, 0.5, 0.3, 0.2, 0.3, 0.5, 2, 5, 10]
      };
    }
    drop(bet, risk = 'medium') {
      const table = this.multipliers[risk] || this.multipliers.medium;
      const slots = table.length;
      const path = [];
      let position = 0;
      for (let i = 0; i < this.rows; i++) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        position += dir;
        path.push(dir);
      }
      const center = Math.floor(this.rows / 2);
      let bucket = Math.round((position + this.rows) / 2 * ((slots - 1) / this.rows));
      bucket = Math.max(0, Math.min(slots - 1, bucket));
      const multiplier = table[bucket];
      const payout = Math.floor(bet * multiplier);
      return { path, bucket, multiplier, payout, win: multiplier >= 1 };
    }
  }

  // ==========================================================
  // 11. WHEEL OF FORTUNE
  // ==========================================================
  class WheelEngine {
    constructor() {
      // 20 segments, weighted toward small multipliers like a real money wheel.
      this.segments = [
        1, 2, 1, 5, 1, 2, 1, 3, 1, 2,
        1, 10, 1, 2, 1, 3, 1, 2, 1, 20
      ];
    }
    spin(bet) {
      const index = randInt(this.segments.length);
      const multiplier = this.segments[index];
      const payout = bet * multiplier;
      return { index, multiplier, payout, win: multiplier > 1, segments: this.segments };
    }
  }

  root.SlotMachineEngine = SlotMachineEngine;
  root.BlackjackEngine = BlackjackEngine;
  root.RouletteEngine = RouletteEngine;
  root.VideoPokerEngine = VideoPokerEngine;
  root.BaccaratEngine = BaccaratEngine;
  root.CrapsEngine = CrapsEngine;
  root.SicBoEngine = SicBoEngine;
  root.HigherLowerEngine = HigherLowerEngine;
  root.CoinFlipEngine = CoinFlipEngine;
  root.PlinkoEngine = PlinkoEngine;
  root.WheelEngine = WheelEngine;
})(typeof window !== 'undefined' ? window : globalThis);

// ---- src/core/p2p.js ----
/**
 * P2P network manager — WebRTC via PeerJS, no server/database required.
 * PeerJS's free public signalling server is only used to broker the initial
 * handshake; all game state travels directly peer-to-peer afterwards.
 * One instance is shared by the board games (Tic-Tac-Toe, Connect 4, Chess)
 * and the casino "duel" games (Coin Flip, Higher/Lower, Dice).
 */
(function (root) {
  'use strict';

  const NAMESPACE = 'arbeitszeitbetrug_v5_';

  class P2PNetworkManager {
    constructor() {
      this.peer = null;
      this.conn = null;
      this.isHost = false;
      this.roomCode = null;
      this.username = 'Player';
      this.remoteUsername = null;
      this.callbacks = {
        onConnected: null,
        onDisconnected: null,
        onData: null,
        onError: null
      };
    }

    getPeerClass() {
      return (typeof window !== 'undefined' && window.Peer) || (typeof Peer !== 'undefined' ? Peer : null);
    }

    _iceConfig() {
      return {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      };
    }

    generatePin() {
      return Math.floor(1000 + Math.random() * 9000).toString();
    }

    hostRoom(username) {
      this.disconnect();
      this.isHost = true;
      this.username = username || this.username;
      this.roomCode = this.generatePin();
      const PeerClass = this.getPeerClass();
      if (!PeerClass) { this._error('PeerJS ist nicht geladen.'); return null; }

      try {
        this.peer = new PeerClass(NAMESPACE + this.roomCode, this._iceConfig());
        this.peer.on('connection', (connection) => {
          this.conn = connection;
          this._bind();
        });
        this.peer.on('error', (err) => {
          if (err && err.type === 'unavailable-id') {
            this.roomCode = this.generatePin();
            this.hostRoom(this.username);
          } else {
            this._error((err && err.message) || 'Verbindungsfehler');
          }
        });
      } catch (e) {
        this._error('WebRTC Peer konnte nicht gestartet werden.');
      }
      return this.roomCode;
    }

    joinRoom(code, username) {
      this.disconnect();
      this.isHost = false;
      this.username = username || this.username;
      this.roomCode = (code || '').trim();
      const PeerClass = this.getPeerClass();
      if (!PeerClass) { this._error('PeerJS ist nicht geladen.'); return; }

      try {
        this.peer = new PeerClass(this._iceConfig());
        this.peer.on('open', () => {
          this.conn = this.peer.connect(NAMESPACE + this.roomCode, { reliable: true });
          this._bind();
        });
        this.peer.on('error', (err) => {
          const isUnavailable = err && err.type === 'peer-unavailable';
          this._error(isUnavailable ? 'PIN nicht gefunden oder Host offline.' : ((err && err.message) || 'Verbindungsfehler'));
        });
      } catch (e) {
        this._error('Verbindung zum Raum fehlgeschlagen.');
      }
    }

    _bind() {
      if (!this.conn) return;
      this.conn.on('open', () => {
        this.send({ type: 'HANDSHAKE', name: this.username });
        if (this.callbacks.onConnected) {
          this.callbacks.onConnected({ isHost: this.isHost, roomCode: this.roomCode });
        }
      });
      this.conn.on('data', (data) => {
        if (data && data.type === 'HANDSHAKE') this.remoteUsername = data.name;
        if (this.callbacks.onData) this.callbacks.onData(data);
      });
      this.conn.on('close', () => {
        if (this.callbacks.onDisconnected) this.callbacks.onDisconnected();
      });
      this.conn.on('error', () => this._error('Netzwerkverbindung unterbrochen.'));
    }

    _error(msg) {
      if (this.callbacks.onError) this.callbacks.onError(msg);
    }

    send(data) {
      if (this.conn && this.conn.open) this.conn.send(data);
    }

    isConnected() {
      return !!(this.conn && this.conn.open);
    }

    disconnect() {
      if (this.conn) { try { this.conn.close(); } catch (e) {} this.conn = null; }
      if (this.peer) { try { this.peer.destroy(); } catch (e) {} this.peer = null; }
      this.roomCode = null;
      this.remoteUsername = null;
    }
  }

  root.P2PNetworkManager = P2PNetworkManager;
})(typeof window !== 'undefined' ? window : globalThis);

// ---- src/ui/theme.js ----
/**
 * Apple HIG inspired design tokens & component styles.
 * Adaptive light/dark via prefers-color-scheme, systemBlue accent,
 * SF Pro / system-ui font stack, 8pt spacing grid, 44pt minimum tap targets,
 * translucent "Liquid Glass" surfaces.
 */
(function (root) {
  'use strict';

  root.ARCADE_THEME_CSS = `
  :host { color-scheme: light dark; }

  .az-root {
    --az-blue: #007AFF;
    --az-green: #34C759;
    --az-red: #FF3B30;
    --az-orange: #FF9500;
    --az-yellow: #FFCC00;

    --az-label: #000000;
    --az-secondary-label: rgba(60, 60, 67, 0.6);
    --az-tertiary-label: rgba(60, 60, 67, 0.3);
    --az-bg: #FFFFFF;
    --az-bg-elevated: rgba(255, 255, 255, 0.75);
    --az-grouped-bg: #F2F2F7;
    --az-fill: rgba(120, 120, 128, 0.12);
    --az-separator: rgba(60, 60, 67, 0.29);

    --az-space-1: 4px;
    --az-space-2: 8px;
    --az-space-3: 16px;
    --az-space-4: 24px;
    --az-space-5: 32px;
    --az-radius: 14px;
    --az-radius-sm: 10px;
    --az-tap: 44px;

    font-family: 'SF Pro Text', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    color: var(--az-label);
  }

  @media (prefers-color-scheme: dark) {
    .az-root:not(.az-force-light) {
      --az-label: #FFFFFF;
      --az-secondary-label: rgba(235, 235, 245, 0.6);
      --az-tertiary-label: rgba(235, 235, 245, 0.3);
      --az-bg: #1C1C1E;
      --az-bg-elevated: rgba(30, 30, 32, 0.78);
      --az-grouped-bg: #000000;
      --az-fill: rgba(120, 120, 128, 0.24);
      --az-separator: rgba(84, 84, 88, 0.6);
    }
  }
  .az-root.az-force-dark {
    --az-label: #FFFFFF;
    --az-secondary-label: rgba(235, 235, 245, 0.6);
    --az-tertiary-label: rgba(235, 235, 245, 0.3);
    --az-bg: #1C1C1E;
    --az-bg-elevated: rgba(30, 30, 32, 0.78);
    --az-grouped-bg: #000000;
    --az-fill: rgba(120, 120, 128, 0.24);
    --az-separator: rgba(84, 84, 88, 0.6);
  }

  .az-root, .az-root * { box-sizing: border-box; }

  .az-text-large-title { font-size: 28px; font-weight: 700; letter-spacing: -0.3px; }
  .az-text-title2 { font-size: 20px; font-weight: 700; }
  .az-text-title3 { font-size: 17px; font-weight: 600; }
  .az-text-headline { font-size: 15px; font-weight: 600; }
  .az-text-body { font-size: 15px; font-weight: 400; }
  .az-text-callout { font-size: 14px; font-weight: 400; }
  .az-text-footnote { font-size: 12px; font-weight: 400; color: var(--az-secondary-label); }
  .az-text-caption { font-size: 11px; font-weight: 500; color: var(--az-secondary-label); }

  /* Liquid-glass surface */
  .az-glass {
    background: var(--az-bg-elevated);
    -webkit-backdrop-filter: blur(24px) saturate(1.6);
    backdrop-filter: blur(24px) saturate(1.6);
    border: 1px solid var(--az-separator);
  }

  .az-card {
    background: var(--az-fill);
    border-radius: var(--az-radius);
    padding: var(--az-space-3);
  }

  .az-btn {
    min-height: var(--az-tap);
    padding: 0 var(--az-space-3);
    border-radius: var(--az-radius-sm);
    border: none;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--az-space-2);
    transition: opacity 0.15s ease, transform 0.1s ease;
    color: #FFFFFF;
    background: var(--az-blue);
  }
  .az-btn:active { transform: scale(0.97); opacity: 0.85; }
  .az-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .az-btn.az-btn-secondary { background: var(--az-fill); color: var(--az-blue); }
  .az-btn.az-btn-success { background: var(--az-green); }
  .az-btn.az-btn-danger { background: var(--az-red); }
  .az-btn.az-btn-plain { background: transparent; color: var(--az-blue); padding: 0 var(--az-space-2); min-height: 32px; }
  .az-btn.az-btn-icon { width: var(--az-tap); height: var(--az-tap); padding: 0; background: var(--az-fill); color: var(--az-label); border-radius: 50%; font-size: 16px; }
  .az-btn.az-btn-block { width: 100%; }
  .az-btn.az-btn-sm { min-height: 32px; padding: 0 var(--az-space-2); font-size: 13px; border-radius: 8px; }

  .az-segmented {
    display: flex;
    background: var(--az-fill);
    border-radius: var(--az-radius-sm);
    padding: 2px;
    gap: 2px;
  }
  .az-segmented button {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--az-secondary-label);
    padding: 8px 6px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    min-height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: all 0.2s ease;
  }
  .az-segmented button.az-active {
    background: var(--az-bg);
    color: var(--az-label);
    box-shadow: 0 1px 4px rgba(0,0,0,0.15);
  }

  .az-input {
    min-height: var(--az-tap);
    border-radius: var(--az-radius-sm);
    border: 1px solid var(--az-separator);
    background: var(--az-bg);
    color: var(--az-label);
    padding: 0 var(--az-space-2);
    font-size: 15px;
    outline: none;
  }
  .az-input:focus { border-color: var(--az-blue); }

  .az-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--az-fill);
    color: var(--az-label);
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 700;
  }
  .az-badge.az-badge-gold { background: rgba(255, 204, 0, 0.18); color: #B8860B; }
  @media (prefers-color-scheme: dark) {
    .az-root:not(.az-force-light) .az-badge.az-badge-gold { color: var(--az-yellow); }
  }

  .az-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--az-space-2); }
  .az-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--az-space-2); }

  .az-game-tile {
    background: var(--az-fill);
    border-radius: var(--az-radius);
    padding: var(--az-space-2);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    cursor: pointer;
    min-height: 64px;
    border: 1px solid transparent;
    transition: all 0.15s ease;
  }
  .az-game-tile:hover { background: rgba(0, 122, 255, 0.12); border-color: var(--az-blue); }
  .az-game-tile .az-tile-icon { font-size: 22px; }
  .az-game-tile .az-tile-label { font-size: 11px; font-weight: 600; text-align: center; color: var(--az-label); }

  .az-scroll { overflow-y: auto; }
  .az-scroll::-webkit-scrollbar { width: 6px; }
  .az-scroll::-webkit-scrollbar-thumb { background: var(--az-separator); border-radius: 3px; }

  .az-divider { height: 1px; background: var(--az-separator); border: none; margin: var(--az-space-2) 0; }

  .az-flex { display: flex; align-items: center; }
  .az-flex-between { display: flex; align-items: center; justify-content: space-between; }
  .az-flex-col { display: flex; flex-direction: column; }
  .az-gap-1 { gap: var(--az-space-1); }
  .az-gap-2 { gap: var(--az-space-2); }
  .az-gap-3 { gap: var(--az-space-3); }

  /* Casino-specific components */
  .az-playing-card {
    width: 42px; height: 60px;
    background: #FFFFFF;
    border-radius: 6px;
    border: 1px solid var(--az-separator);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-size: 15px; font-weight: 700; color: #111111;
    box-shadow: 0 2px 6px rgba(0,0,0,0.18);
    flex-shrink: 0;
  }
  .az-playing-card.az-red { color: #E11D48; }
  .az-playing-card.az-face-down { background: linear-gradient(135deg, var(--az-blue), #5856D6); color: transparent; }
  .az-playing-card.az-held { outline: 2px solid var(--az-green); outline-offset: 2px; }
  .az-hand-row { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }

  .az-slot-reels { display: flex; gap: 8px; background: var(--az-grouped-bg); padding: 10px; border-radius: 12px; }
  .az-slot-reel { width: 48px; height: 48px; background: var(--az-bg); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 26px; border: 1px solid var(--az-separator); }
  .az-slot-reel.az-spinning { animation: az-reel-blur 0.09s infinite linear; }
  @keyframes az-reel-blur { 0% { filter: blur(1px); } 50% { filter: blur(3px); } 100% { filter: blur(1px); } }

  .az-die {
    width: 40px; height: 40px; border-radius: 9px; background: #FFFFFF; color: #111;
    display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2); border: 1px solid var(--az-separator); flex-shrink: 0;
  }

  .az-coin {
    width: 56px; height: 56px; border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #FFE58A, #E8B923);
    display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; color: #6b4e00;
    box-shadow: 0 3px 10px rgba(0,0,0,0.25); border: 2px solid #C79A0E;
  }
  .az-coin.az-flipping { animation: az-coin-flip 0.6s ease-in-out; }
  @keyframes az-coin-flip { 0% { transform: rotateY(0deg); } 100% { transform: rotateY(1440deg); } }

  .az-roulette-number {
    width: 56px; height: 56px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; color: #fff;
    box-shadow: 0 3px 10px rgba(0,0,0,0.25);
  }
  .az-roulette-number.az-num-red { background: #E11D48; }
  .az-roulette-number.az-num-black { background: #1C1C1E; }
  .az-roulette-number.az-num-green { background: var(--az-green); }

  .az-bet-row { display: flex; align-items: center; gap: var(--az-space-2); }
  .az-bet-row .az-input { width: 84px; text-align: center; }

  .az-choice-row { display: flex; gap: var(--az-space-2); flex-wrap: wrap; justify-content: center; }
  .az-choice-btn {
    min-height: var(--az-tap); padding: 0 14px; border-radius: 999px; border: 1.5px solid var(--az-separator);
    background: var(--az-bg); color: var(--az-label); font-weight: 600; font-size: 13px; cursor: pointer;
  }
  .az-choice-btn.az-active { border-color: var(--az-blue); background: rgba(0,122,255,0.14); color: var(--az-blue); }

  .az-wheel-track { display: flex; gap: 4px; overflow: hidden; padding: 8px 0; position: relative; }
  .az-wheel-track::before {
    content: ''; position: absolute; left: 50%; top: 0; transform: translateX(-50%);
    border-left: 7px solid transparent; border-right: 7px solid transparent; border-top: 10px solid var(--az-red);
    z-index: 2;
  }
  .az-wheel-seg {
    min-width: 44px; height: 44px; border-radius: 8px; background: var(--az-fill);
    display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; flex-shrink: 0;
  }
  .az-wheel-seg.az-landed { background: var(--az-blue); color: #fff; }

  .az-result-banner {
    text-align: center; padding: var(--az-space-2); border-radius: var(--az-radius-sm);
    font-weight: 700; font-size: 14px; background: var(--az-fill); min-height: 20px;
  }
  .az-result-banner.az-win { background: rgba(52, 199, 89, 0.16); color: var(--az-green); }
  .az-result-banner.az-lose { background: rgba(255, 59, 48, 0.14); color: var(--az-red); }

  @keyframes az-pop { 0% { transform: scale(0.6); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
  @keyframes az-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
  @keyframes az-pulse { 0%, 100% { box-shadow: 0 0 0 rgba(0,122,255,0.4); } 50% { box-shadow: 0 0 16px rgba(0,122,255,0.5); } }
  .az-anim-pop { animation: az-pop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
  .az-anim-shake { animation: az-shake 0.3s ease-in-out; }
  `;
})(typeof window !== 'undefined' ? window : globalThis);

// ---- src/ui/casino-panels.js ----
/**
 * Casino tab: registry of per-game panels. Each panel renders itself into a
 * container element using the shared engines from core/casino-games.js and
 * settles bets through the shared CasinoWallet. Games marked `duel: true`
 * additionally support a peer-to-peer "vs. friend" mode over the same
 * WebRTC connection used by the Arcade tab (see startQuickDuel below).
 */
(function (root) {
  'use strict';

  function fmt(n) { return n.toLocaleString('de-DE'); }

  function cardHtml(card, opts = {}) {
    if (!card || opts.faceDown) return `<div class="az-playing-card az-face-down">🂠</div>`;
    return `<div class="az-playing-card ${card.red ? 'az-red' : ''} ${opts.held ? 'az-held' : ''}">
      <div>${card.rank}</div><div>${card.suit}</div>
    </div>`;
  }

  function dieHtml(v) {
    const pips = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    return `<div class="az-die">${pips[v] || v}</div>`;
  }

  function betControl(id, defaultValue = 10) {
    return `<div class="az-bet-row">
      <span class="az-text-footnote">Einsatz</span>
      <input id="${id}" type="number" class="az-input" value="${defaultValue}" min="1" step="1">
    </div>`;
  }

  function readBet(container, id, wallet) {
    const input = container.querySelector('#' + id);
    let bet = parseInt(input.value, 10) || 0;
    if (bet < 1) bet = 1;
    if (bet > wallet.balance) bet = wallet.balance;
    input.value = bet;
    return bet;
  }

  function setBanner(el, text, kind) {
    el.textContent = text;
    el.className = 'az-result-banner' + (kind ? ' az-' + kind : '');
  }

  function duelToggleHtml(connected) {
    return `<div class="az-segmented" style="margin-bottom:8px;">
      <button data-duel-mode="house" class="az-active">🏠 Gegen Haus</button>
      <button data-duel-mode="friend" ${connected ? '' : 'disabled title="Erst im Arcade-Tab verbinden"'}>🌐 Gegen Freund</button>
    </div>`;
  }

  function wireDuelToggle(container, ctx, onModeChange) {
    let mode = 'house';
    const btns = container.querySelectorAll('[data-duel-mode]');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        mode = btn.getAttribute('data-duel-mode');
        btns.forEach(b => b.classList.toggle('az-active', b === btn));
        onModeChange(mode);
      });
    });
    return () => mode;
  }

  // ==========================================================
  // SLOT MACHINE
  // ==========================================================
  function renderSlot(container, ctx) {
    const engine = new root.SlotMachineEngine();
    container.innerHTML = `
      <div class="az-flex-col az-gap-3" style="align-items:center;">
        <div class="az-slot-reels">
          <div class="az-slot-reel" id="r0">💼</div>
          <div class="az-slot-reel" id="r1">💰</div>
          <div class="az-slot-reel" id="r2">7️⃣</div>
        </div>
        ${betControl('slot-bet', 10)}
        <button id="slot-spin" class="az-btn az-btn-block">🎰 Spin</button>
        <div class="az-result-banner" id="slot-banner">Viel Glück!</div>
      </div>`;
    const banner = container.querySelector('#slot-banner');
    const spinBtn = container.querySelector('#slot-spin');
    const reels = [container.querySelector('#r0'), container.querySelector('#r1'), container.querySelector('#r2')];

    spinBtn.onclick = () => {
      const bet = readBet(container, 'slot-bet', ctx.wallet);
      if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins!', 'lose'); return; }
      spinBtn.disabled = true;
      reels.forEach(r => r.classList.add('az-spinning'));
      ctx.playSound('spin');
      const result = engine.spin(bet);
      let ticks = 0;
      const iv = setInterval(() => {
        reels.forEach(r => r.textContent = engine.symbols[Math.floor(Math.random() * engine.symbols.length)]);
        ticks++;
        if (ticks > 8) {
          clearInterval(iv);
          reels.forEach((r, i) => { r.classList.remove('az-spinning'); r.textContent = result.reels[i]; });
          spinBtn.disabled = false;
          if (result.win) {
            ctx.wallet.award(result.payout);
            setBanner(banner, `${result.label}! +${fmt(result.payout)} 💰`, 'win');
            ctx.playSound('win');
          } else {
            setBanner(banner, 'Kein Treffer, nochmal versuchen!', 'lose');
          }
        }
      }, 80);
    };
  }

  // ==========================================================
  // BLACKJACK
  // ==========================================================
  function renderBlackjack(container, ctx) {
    const engine = new root.BlackjackEngine();
    container.innerHTML = `
      <div class="az-flex-col az-gap-2">
        <div class="az-text-footnote">Dealer</div>
        <div class="az-hand-row" id="bj-dealer"></div>
        <div class="az-text-footnote">Du</div>
        <div class="az-hand-row" id="bj-player"></div>
        <div class="az-result-banner" id="bj-banner">Setze deinen Einsatz und drücke Deal.</div>
        <div class="az-flex az-gap-2" id="bj-controls">
          ${betControl('bj-bet', 25)}
          <button id="bj-deal" class="az-btn">Deal</button>
        </div>
      </div>`;
    const dealerEl = container.querySelector('#bj-dealer');
    const playerEl = container.querySelector('#bj-player');
    const banner = container.querySelector('#bj-banner');
    const controls = container.querySelector('#bj-controls');

    function renderHands(hideHoleCard) {
      dealerEl.innerHTML = engine.dealerHand.map((c, i) => cardHtml(c, { faceDown: hideHoleCard && i === 1 })).join('');
      playerEl.innerHTML = engine.playerHand.map(c => cardHtml(c)).join('');
    }

    function showPlayControls() {
      controls.innerHTML = `<button id="bj-hit" class="az-btn">Hit</button><button id="bj-stand" class="az-btn az-btn-secondary">Stand</button>`;
      container.querySelector('#bj-hit').onclick = () => {
        const r = engine.hit();
        renderHands(true);
        if (engine.phase === 'done') finish();
      };
      container.querySelector('#bj-stand').onclick = () => {
        engine.stand();
        finish();
      };
    }

    function showDealControls() {
      controls.innerHTML = `${betControl('bj-bet', 25)}<button id="bj-deal" class="az-btn">Deal</button>`;
      container.querySelector('#bj-deal').onclick = deal;
    }

    function finish() {
      renderHands(false);
      const r = engine.result;
      const labels = {
        blackjack: 'Blackjack! 🎉', win: 'Gewonnen!', dealer_bust: 'Dealer überkauft — gewonnen!',
        lose: 'Verloren.', dealer_blackjack: 'Dealer hat Blackjack.', bust: 'Überkauft!', push: 'Unentschieden.'
      };
      if (r.payout > 0) ctx.wallet.award(r.payout);
      setBanner(banner, `${labels[r.outcome] || ''} (${r.payout > 0 ? '+' + fmt(r.payout) : '±0'})`, r.payout > engine.bet ? 'win' : (r.payout === engine.bet ? '' : 'lose'));
      ctx.playSound(r.payout > engine.bet ? 'win' : 'lose');
      showDealControls();
    }

    function deal() {
      const bet = readBet(container, 'bj-bet', ctx.wallet);
      if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins!', 'lose'); return; }
      engine.deal(bet);
      renderHands(true);
      if (engine.phase === 'done') { finish(); return; }
      setBanner(banner, 'Hit oder Stand?', '');
      showPlayControls();
    }

    container.querySelector('#bj-deal').onclick = deal;
  }

  // ==========================================================
  // ROULETTE
  // ==========================================================
  function renderRoulette(container, ctx) {
    const engine = new root.RouletteEngine();
    container.innerHTML = `
      <div class="az-flex-col az-gap-3" style="align-items:center;">
        <div class="az-roulette-number az-num-green" id="rl-result">?</div>
        ${betControl('rl-bet', 20)}
        <div class="az-choice-row" id="rl-choices">
          <button class="az-choice-btn az-active" data-type="color" data-value="red">Rot</button>
          <button class="az-choice-btn" data-type="color" data-value="black">Schwarz</button>
          <button class="az-choice-btn" data-type="parity" data-value="odd">Ungerade</button>
          <button class="az-choice-btn" data-type="parity" data-value="even">Gerade</button>
          <button class="az-choice-btn" data-type="half" data-value="low">1–18</button>
          <button class="az-choice-btn" data-type="half" data-value="high">19–36</button>
          <button class="az-choice-btn" data-type="dozen" data-value="1">1. Dutzend</button>
          <button class="az-choice-btn" data-type="dozen" data-value="2">2. Dutzend</button>
          <button class="az-choice-btn" data-type="dozen" data-value="3">3. Dutzend</button>
        </div>
        <button id="rl-spin" class="az-btn az-btn-block">🎡 Drehen</button>
        <div class="az-result-banner" id="rl-banner">Wähle deine Wette.</div>
      </div>`;
    let selected = { type: 'color', value: 'red' };
    container.querySelectorAll('#rl-choices .az-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('#rl-choices .az-choice-btn').forEach(b => b.classList.remove('az-active'));
        btn.classList.add('az-active');
        selected = { type: btn.getAttribute('data-type'), value: isNaN(btn.getAttribute('data-value')) ? btn.getAttribute('data-value') : parseInt(btn.getAttribute('data-value'), 10) };
      });
    });
    const banner = container.querySelector('#rl-banner');
    const resultEl = container.querySelector('#rl-result');
    container.querySelector('#rl-spin').onclick = () => {
      const bet = readBet(container, 'rl-bet', ctx.wallet);
      if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins!', 'lose'); return; }
      ctx.playSound('spin');
      const result = engine.spin(selected.type, selected.value, bet);
      resultEl.textContent = '...';
      setTimeout(() => {
        resultEl.textContent = result.number;
        resultEl.className = 'az-roulette-number az-num-' + result.color;
        if (result.win) {
          ctx.wallet.award(result.payout);
          setBanner(banner, `${result.number} (${result.color}) — Gewonnen! +${fmt(result.payout)}`, 'win');
          ctx.playSound('win');
        } else {
          setBanner(banner, `${result.number} (${result.color}) — Verloren.`, 'lose');
        }
      }, 700);
    };
  }

  // ==========================================================
  // VIDEO POKER (Jacks or Better)
  // ==========================================================
  function renderVideoPoker(container, ctx) {
    const engine = new root.VideoPokerEngine();
    let held = [];
    container.innerHTML = `
      <div class="az-flex-col az-gap-3" style="align-items:center;">
        <div class="az-hand-row" id="vp-hand"></div>
        <div class="az-text-footnote">Bube-oder-besser gewinnt · Karten antippen zum Halten</div>
        ${betControl('vp-bet', 10)}
        <button id="vp-action" class="az-btn az-btn-block">Deal</button>
        <div class="az-result-banner" id="vp-banner">Setze deinen Einsatz und drücke Deal.</div>
      </div>`;
    const handEl = container.querySelector('#vp-hand');
    const banner = container.querySelector('#vp-banner');
    const actionBtn = container.querySelector('#vp-action');

    function renderHand(hand) {
      handEl.innerHTML = hand.map((c, i) => cardHtml(c, { held: held.includes(i) })).join('');
      handEl.querySelectorAll('.az-playing-card').forEach((cardEl, i) => {
        cardEl.style.cursor = 'pointer';
        cardEl.onclick = () => {
          if (engine.phase !== 'held') return;
          if (held.includes(i)) held = held.filter(h => h !== i); else held.push(i);
          renderHand(engine.hand);
        };
      });
    }

    actionBtn.onclick = () => {
      if (engine.phase === 'idle' || engine.phase === 'done') {
        const bet = readBet(container, 'vp-bet', ctx.wallet);
        if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins!', 'lose'); return; }
        held = [];
        const hand = engine.deal(bet);
        renderHand(hand);
        setBanner(banner, 'Karten halten und ziehen.', '');
        actionBtn.textContent = 'Ziehen';
      } else {
        const r = engine.draw(held);
        renderHand(r.hand);
        if (r.win) {
          ctx.wallet.award(r.payout);
          setBanner(banner, `${r.rank.label}! +${fmt(r.payout)} 💰`, 'win');
          ctx.playSound('win');
        } else {
          setBanner(banner, `${r.rank.label} — kein Gewinn.`, 'lose');
        }
        actionBtn.textContent = 'Deal';
      }
    };
  }

  // ==========================================================
  // BACCARAT
  // ==========================================================
  function renderBaccarat(container, ctx) {
    const engine = new root.BaccaratEngine();
    container.innerHTML = `
      <div class="az-flex-col az-gap-3" style="align-items:center;">
        <div class="az-flex-col az-gap-1" style="align-items:center;">
          <div class="az-text-footnote">Banker</div>
          <div class="az-hand-row" id="bc-banker"></div>
        </div>
        <div class="az-flex-col az-gap-1" style="align-items:center;">
          <div class="az-text-footnote">Spieler</div>
          <div class="az-hand-row" id="bc-player"></div>
        </div>
        ${betControl('bc-bet', 20)}
        <div class="az-choice-row">
          <button class="az-choice-btn az-active" data-bet="player">Spieler (1:1)</button>
          <button class="az-choice-btn" data-bet="banker">Banker (0.95:1)</button>
          <button class="az-choice-btn" data-bet="tie">Unentschieden (8:1)</button>
        </div>
        <button id="bc-deal" class="az-btn az-btn-block">Karten geben</button>
        <div class="az-result-banner" id="bc-banner">Wähle deine Wette.</div>
      </div>`;
    let betOn = 'player';
    container.querySelectorAll('.az-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.az-choice-btn').forEach(b => b.classList.remove('az-active'));
        btn.classList.add('az-active');
        betOn = btn.getAttribute('data-bet');
      });
    });
    const banner = container.querySelector('#bc-banner');
    container.querySelector('#bc-deal').onclick = () => {
      const bet = readBet(container, 'bc-bet', ctx.wallet);
      if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins!', 'lose'); return; }
      const r = engine.play(betOn, bet);
      container.querySelector('#bc-banker').innerHTML = r.banker.map(c => cardHtml(c)).join('');
      container.querySelector('#bc-player').innerHTML = r.player.map(c => cardHtml(c)).join('');
      const won = r.payout > bet;
      const push = r.payout === bet;
      if (r.payout > 0) ctx.wallet.award(r.payout);
      const winnerLabel = { player: 'Spieler', banker: 'Banker', tie: 'Unentschieden' }[r.winner];
      setBanner(banner, `${winnerLabel} gewinnt (${r.playerTotal} vs ${r.bankerTotal}) ${won ? '+' + fmt(r.payout) : push ? '± 0' : 'verloren'}`, won ? 'win' : (push ? '' : 'lose'));
      ctx.playSound(won ? 'win' : 'lose');
    };
  }

  // ==========================================================
  // CRAPS (Pass Line + Duel)
  // ==========================================================
  function renderCraps(container, ctx) {
    const engine = new root.CrapsEngine();
    container.innerHTML = `
      <div class="az-flex-col az-gap-3" style="align-items:center;">
        ${duelToggleHtml(ctx.duel.isConnected())}
        <div class="az-flex az-gap-2" id="cr-dice"><div class="az-die">?</div><div class="az-die">?</div></div>
        ${betControl('cr-bet', 15)}
        <button id="cr-roll" class="az-btn az-btn-block">🎲 Werfen</button>
        <div class="az-result-banner" id="cr-banner">Come-out Roll: 7/11 gewinnt sofort, 2/3/12 verliert sofort.</div>
      </div>`;
    const banner = container.querySelector('#cr-banner');
    const diceEl = container.querySelector('#cr-dice');
    const rollBtn = container.querySelector('#cr-roll');
    let duelMode = 'house';
    let duelPending = false;

    wireDuelToggle(container, ctx, (mode) => {
      duelMode = mode;
      rollBtn.textContent = mode === 'friend' ? '🌐 Duell starten' : '🎲 Werfen';
      setBanner(banner, mode === 'friend' ? 'Beide setzen den gleichen Einsatz — höhere Augensumme gewinnt.' : 'Come-out Roll: 7/11 gewinnt sofort, 2/3/12 verliert sofort.', '');
    });

    ctx.duel.setHandler((data) => {
      if (data.type !== 'craps_start' && data.type !== 'craps_response') return;
      if (data.type === 'craps_start') {
        if (duelPending) return;
        if (!ctx.wallet.place(data.stake)) { setBanner(banner, 'Nicht genug Coins für das Duell!', 'lose'); return; }
        const mine = root.CrapsEngine.duelRoll();
        diceEl.innerHTML = mine.dice.map(dieHtml).join('');
        ctx.duel.send('craps_response', { mySum: mine.sum, stake: data.stake });
        resolveDuel(data.hostSum, mine.sum, data.stake);
      } else if (data.type === 'craps_response') {
        resolveDuel(duelPending.hostSum, data.mySum, duelPending.stake);
        duelPending = false;
      }
    });

    function resolveDuel(hostSum, guestSum, stake) {
      if (hostSum === guestSum) { ctx.wallet.award(stake); setBanner(banner, `Unentschieden (${hostSum}) — Einsatz zurück.`, ''); return; }
      const iAmHost = ctx.duel.isHost();
      const hostWins = hostSum > guestSum;
      const iWin = (iAmHost && hostWins) || (!iAmHost && !hostWins);
      if (iWin) { ctx.wallet.award(stake * 2); setBanner(banner, `Du gewinnst! (${iAmHost ? hostSum : guestSum} vs ${iAmHost ? guestSum : hostSum})`, 'win'); ctx.playSound('win'); }
      else { setBanner(banner, `Verloren. (${iAmHost ? hostSum : guestSum} vs ${iAmHost ? guestSum : hostSum})`, 'lose'); ctx.playSound('lose'); }
    }

    rollBtn.onclick = () => {
      const bet = readBet(container, 'cr-bet', ctx.wallet);
      if (duelMode === 'friend') {
        if (!ctx.duel.isConnected()) { setBanner(banner, 'Nicht verbunden.', 'lose'); return; }
        if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins!', 'lose'); return; }
        const mine = root.CrapsEngine.duelRoll();
        diceEl.innerHTML = mine.dice.map(dieHtml).join('');
        duelPending = { hostSum: mine.sum, stake: bet };
        ctx.duel.send('craps_start', { hostSum: mine.sum, stake: bet });
        setBanner(banner, 'Warte auf deinen Freund…', '');
        return;
      }
      if (engine.point === null) {
        if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins!', 'lose'); return; }
        engine.reset();
        const r = engine.start(bet);
        handleRoll(r);
      } else {
        const r = engine.roll();
        handleRoll(r);
      }
    };

    function handleRoll(r) {
      diceEl.innerHTML = r.dice.map(dieHtml).join('');
      if (r.done) {
        if (r.outcome === 'win') { ctx.wallet.award(r.payout); setBanner(banner, `${r.sum} — Gewonnen! +${fmt(r.payout)}`, 'win'); ctx.playSound('win'); }
        else { setBanner(banner, `${r.sum} — Verloren.`, 'lose'); ctx.playSound('lose'); }
        engine.reset();
      } else {
        setBanner(banner, `Punkt: ${r.point}. Wirf erneut — 7 verliert, ${r.point} gewinnt.`, '');
      }
    }
  }

  // ==========================================================
  // SIC BO
  // ==========================================================
  function renderSicBo(container, ctx) {
    const engine = new root.SicBoEngine();
    container.innerHTML = `
      <div class="az-flex-col az-gap-3" style="align-items:center;">
        <div class="az-flex az-gap-2" id="sb-dice"><div class="az-die">?</div><div class="az-die">?</div><div class="az-die">?</div></div>
        ${betControl('sb-bet', 15)}
        <div class="az-choice-row">
          <button class="az-choice-btn az-active" data-bet="big">Groß (11–17)</button>
          <button class="az-choice-btn" data-bet="small">Klein (4–10)</button>
          <button class="az-choice-btn" data-bet="any_triple">Jeder Pasch (×30)</button>
        </div>
        <button id="sb-roll" class="az-btn az-btn-block">🎲 Würfeln</button>
        <div class="az-result-banner" id="sb-banner">Groß/Klein gewinnt 2:1, außer bei Pasch.</div>
      </div>`;
    let betType = 'big';
    container.querySelectorAll('.az-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.az-choice-btn').forEach(b => b.classList.remove('az-active'));
        btn.classList.add('az-active');
        betType = btn.getAttribute('data-bet');
      });
    });
    const banner = container.querySelector('#sb-banner');
    const diceEl = container.querySelector('#sb-dice');
    container.querySelector('#sb-roll').onclick = () => {
      const bet = readBet(container, 'sb-bet', ctx.wallet);
      if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins!', 'lose'); return; }
      const r = engine.roll(betType, null, bet);
      diceEl.innerHTML = r.dice.map(dieHtml).join('');
      if (r.win) { ctx.wallet.award(r.payout); setBanner(banner, `Summe ${r.sum} — Gewonnen! +${fmt(r.payout)}`, 'win'); ctx.playSound('win'); }
      else { setBanner(banner, `Summe ${r.sum}${r.isTriple ? ' (Pasch)' : ''} — Verloren.`, 'lose'); ctx.playSound('lose'); }
    };
  }

  // ==========================================================
  // HIGHER OR LOWER (+ Duel)
  // ==========================================================
  function renderHigherLower(container, ctx) {
    const engine = new root.HigherLowerEngine();
    container.innerHTML = `
      <div class="az-flex-col az-gap-3" style="align-items:center;">
        ${duelToggleHtml(ctx.duel.isConnected())}
        <div class="az-hand-row" id="hl-card"></div>
        <div class="az-text-footnote" id="hl-streak">Streak: 0</div>
        ${betControl('hl-bet', 10)}
        <div class="az-flex az-gap-2" id="hl-actions">
          <button id="hl-start" class="az-btn az-btn-block">Karte ziehen</button>
        </div>
        <div class="az-result-banner" id="hl-banner">Höher oder niedriger als die aktuelle Karte?</div>
      </div>`;
    const banner = container.querySelector('#hl-banner');
    const cardEl = container.querySelector('#hl-card');
    const streakEl = container.querySelector('#hl-streak');
    const actions = container.querySelector('#hl-actions');
    let duelMode = 'house';
    let duelStake = 0;

    wireDuelToggle(container, ctx, (mode) => {
      duelMode = mode;
      resetActions();
      setBanner(banner, mode === 'friend' ? 'Beide ziehen eine Karte — höchste gewinnt.' : 'Höher oder niedriger als die aktuelle Karte?', '');
    });

    ctx.duel.setHandler((data) => {
      if (data.type === 'hilo_start') {
        if (!ctx.wallet.place(data.stake)) { setBanner(banner, 'Nicht genug Coins für das Duell!', 'lose'); return; }
        const deck = root.CardDeck.createShoe(1);
        const myCard = deck.pop();
        cardEl.innerHTML = cardHtml(myCard);
        ctx.duel.send('hilo_response', { myVal: root.CardDeck.rankValue(myCard.rank), myCard });
        resolveDuel(data.hostVal, root.CardDeck.rankValue(myCard.rank), data.stake, data.hostCard, myCard);
      } else if (data.type === 'hilo_response') {
        resolveDuel(pendingHost.val, data.myVal, pendingHost.stake, pendingHost.card, data.myCard);
      }
    });
    let pendingHost = null;

    function resolveDuel(hostVal, guestVal, stake, hostCard, guestCard) {
      cardEl.innerHTML = cardHtml(hostCard) + cardHtml(guestCard);
      if (hostVal === guestVal) { ctx.wallet.award(stake); setBanner(banner, 'Unentschieden — Einsatz zurück.', ''); return; }
      const iAmHost = ctx.duel.isHost();
      const hostWins = hostVal > guestVal;
      const iWin = (iAmHost && hostWins) || (!iAmHost && !hostWins);
      if (iWin) { ctx.wallet.award(stake * 2); setBanner(banner, 'Du gewinnst das Duell!', 'win'); ctx.playSound('win'); }
      else { setBanner(banner, 'Verloren.', 'lose'); ctx.playSound('lose'); }
    }

    function resetActions() {
      if (duelMode === 'friend') {
        actions.innerHTML = `<button id="hl-duel-start" class="az-btn az-btn-block">🌐 Duell starten</button>`;
        container.querySelector('#hl-duel-start').onclick = () => {
          if (!ctx.duel.isConnected()) { setBanner(banner, 'Nicht verbunden.', 'lose'); return; }
          const bet = readBet(container, 'hl-bet', ctx.wallet);
          if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins!', 'lose'); return; }
          const deck = root.CardDeck.createShoe(1);
          const myCard = deck.pop();
          cardEl.innerHTML = cardHtml(myCard);
          pendingHost = { val: root.CardDeck.rankValue(myCard.rank), stake: bet, card: myCard };
          ctx.duel.send('hilo_start', { hostVal: pendingHost.val, stake: bet, hostCard: myCard });
          setBanner(banner, 'Warte auf deinen Freund…', '');
        };
      } else {
        actions.innerHTML = `<button id="hl-start" class="az-btn az-btn-block">Karte ziehen</button>`;
        container.querySelector('#hl-start').onclick = startSolo;
      }
    }

    function startSolo() {
      const bet = readBet(container, 'hl-bet', ctx.wallet);
      if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins!', 'lose'); return; }
      const r = engine.start(bet);
      cardEl.innerHTML = cardHtml(r.card);
      streakEl.textContent = 'Streak: 0';
      setBanner(banner, 'Höher oder niedriger?', '');
      actions.innerHTML = `<button id="hl-lower" class="az-btn az-btn-secondary">⬇️ Niedriger</button><button id="hl-cash" class="az-btn az-btn-success">💰 Auszahlen</button><button id="hl-higher" class="az-btn">⬆️ Höher</button>`;
      container.querySelector('#hl-higher').onclick = () => guess('higher');
      container.querySelector('#hl-lower').onclick = () => guess('lower');
      container.querySelector('#hl-cash').onclick = cashOut;
    }

    function guess(dir) {
      const r = engine.guess(dir);
      cardEl.innerHTML = cardHtml(r.card);
      if (r.correct) {
        streakEl.textContent = `Streak: ${r.streak} · möglicher Gewinn ${fmt(r.currentPayout)}`;
        setBanner(banner, 'Richtig! Weiter ziehen oder auszahlen.', 'win');
      } else {
        setBanner(banner, 'Falsch geraten — Einsatz verloren.', 'lose');
        ctx.playSound('lose');
        resetActions();
      }
    }

    function cashOut() {
      const r = engine.cashOut();
      if (r) { ctx.wallet.award(r.payout); setBanner(banner, `Ausgezahlt: +${fmt(r.payout)} bei Streak ${r.streak}`, 'win'); ctx.playSound('win'); }
      resetActions();
    }

    resetActions();
  }

  // ==========================================================
  // COIN FLIP (+ Duel)
  // ==========================================================
  function renderCoinFlip(container, ctx) {
    const engine = new root.CoinFlipEngine();
    container.innerHTML = `
      <div class="az-flex-col az-gap-3" style="align-items:center;">
        ${duelToggleHtml(ctx.duel.isConnected())}
        <div class="az-coin" id="cf-coin">🪙</div>
        <div class="az-text-footnote" id="cf-hint">Wähle Kopf oder Zahl.</div>
        ${betControl('cf-bet', 10)}
        <div class="az-choice-row" id="cf-choices">
          <button class="az-choice-btn az-active" data-call="heads">Kopf</button>
          <button class="az-choice-btn" data-call="tails">Zahl</button>
        </div>
        <button id="cf-flip" class="az-btn az-btn-block">Werfen</button>
        <div class="az-result-banner" id="cf-banner">Doppelt oder nichts.</div>
      </div>`;
    let call = 'heads';
    let duelMode = 'house';
    container.querySelectorAll('#cf-choices .az-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('#cf-choices .az-choice-btn').forEach(b => b.classList.remove('az-active'));
        btn.classList.add('az-active');
        call = btn.getAttribute('data-call');
      });
    });
    const banner = container.querySelector('#cf-banner');
    const coinEl = container.querySelector('#cf-coin');
    const hint = container.querySelector('#cf-hint');
    const flipBtn = container.querySelector('#cf-flip');
    const choices = container.querySelector('#cf-choices');

    wireDuelToggle(container, ctx, (mode) => {
      duelMode = mode;
      choices.style.display = mode === 'friend' ? 'none' : 'flex';
      flipBtn.textContent = mode === 'friend' ? '🌐 Duell starten (du = Kopf)' : 'Werfen';
      hint.textContent = mode === 'friend' ? 'Host ist immer Kopf, Freund ist Zahl.' : 'Wähle Kopf oder Zahl.';
    });

    ctx.duel.setHandler((data) => {
      if (data.type !== 'coinflip_start') return;
      if (!ctx.wallet.place(data.stake)) { setBanner(banner, 'Nicht genug Coins für das Duell!', 'lose'); return; }
      animateCoin(data.result, () => {
        const iWin = data.result === 'tails'; // guest is always "tails"
        if (iWin) { ctx.wallet.award(data.stake * 2); setBanner(banner, `${data.result === 'heads' ? 'Kopf' : 'Zahl'}! Du gewinnst!`, 'win'); ctx.playSound('win'); }
        else { setBanner(banner, `${data.result === 'heads' ? 'Kopf' : 'Zahl'}! Verloren.`, 'lose'); ctx.playSound('lose'); }
      });
    });

    function animateCoin(result, done) {
      coinEl.classList.add('az-flipping');
      setTimeout(() => {
        coinEl.classList.remove('az-flipping');
        coinEl.textContent = result === 'heads' ? '👑' : '🔢';
        done();
      }, 600);
    }

    flipBtn.onclick = () => {
      const bet = readBet(container, 'cf-bet', ctx.wallet);
      if (duelMode === 'friend') {
        if (!ctx.duel.isConnected()) { setBanner(banner, 'Nicht verbunden.', 'lose'); return; }
        if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins!', 'lose'); return; }
        const result = root.CoinFlipEngine.duelFlip();
        ctx.duel.send('coinflip_start', { stake: bet, result });
        animateCoin(result, () => {
          const iWin = result === 'heads'; // host is always "heads"
          if (iWin) { ctx.wallet.award(bet * 2); setBanner(banner, `${result === 'heads' ? 'Kopf' : 'Zahl'}! Du gewinnst!`, 'win'); ctx.playSound('win'); }
          else { setBanner(banner, `${result === 'heads' ? 'Kopf' : 'Zahl'}! Verloren.`, 'lose'); ctx.playSound('lose'); }
        });
        return;
      }
      if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins!', 'lose'); return; }
      const r = engine.flip(call, bet);
      animateCoin(r.result, () => {
        if (r.win) { ctx.wallet.award(r.payout); setBanner(banner, `${r.result === 'heads' ? 'Kopf' : 'Zahl'}! Gewonnen! +${fmt(r.payout)}`, 'win'); ctx.playSound('win'); }
        else { setBanner(banner, `${r.result === 'heads' ? 'Kopf' : 'Zahl'}! Verloren.`, 'lose'); ctx.playSound('lose'); }
      });
    };
  }

  // ==========================================================
  // PLINKO
  // ==========================================================
  function renderPlinko(container, ctx) {
    const engine = new root.PlinkoEngine();
    container.innerHTML = `
      <div class="az-flex-col az-gap-3" style="align-items:center;">
        <div class="az-choice-row">
          <button class="az-choice-btn az-active" data-risk="low">Niedrig</button>
          <button class="az-choice-btn" data-risk="medium">Mittel</button>
          <button class="az-choice-btn" data-risk="high">Hoch</button>
        </div>
        <div class="az-flex az-gap-1" id="pl-buckets"></div>
        ${betControl('pl-bet', 10)}
        <button id="pl-drop" class="az-btn az-btn-block">⬇️ Ball fallen lassen</button>
        <div class="az-result-banner" id="pl-banner">Wähle dein Risiko.</div>
      </div>`;
    let risk = 'low';
    container.querySelectorAll('.az-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.az-choice-btn').forEach(b => b.classList.remove('az-active'));
        btn.classList.add('az-active');
        risk = btn.getAttribute('data-risk');
        renderBuckets();
      });
    });
    const banner = container.querySelector('#pl-banner');
    const bucketsEl = container.querySelector('#pl-buckets');

    function renderBuckets(landed = -1) {
      const table = engine.multipliers[risk];
      bucketsEl.innerHTML = table.map((m, i) => `<div class="az-wheel-seg ${i === landed ? 'az-landed' : ''}">${m}×</div>`).join('');
    }
    renderBuckets();

    container.querySelector('#pl-drop').onclick = () => {
      const bet = readBet(container, 'pl-bet', ctx.wallet);
      if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins!', 'lose'); return; }
      const r = engine.drop(bet, risk);
      ctx.playSound('spin');
      setTimeout(() => {
        renderBuckets(r.bucket);
        if (r.payout > bet) { ctx.wallet.award(r.payout); setBanner(banner, `${r.multiplier}× Feld — Gewonnen! +${fmt(r.payout)}`, 'win'); ctx.playSound('win'); }
        else if (r.payout === bet) { ctx.wallet.award(r.payout); setBanner(banner, `${r.multiplier}× Feld — Einsatz zurück.`, ''); }
        else { setBanner(banner, `${r.multiplier}× Feld — Verloren.`, 'lose'); ctx.playSound('lose'); }
      }, 500);
    };
  }

  // ==========================================================
  // WHEEL OF FORTUNE
  // ==========================================================
  function renderWheel(container, ctx) {
    const engine = new root.WheelEngine();
    container.innerHTML = `
      <div class="az-flex-col az-gap-3" style="align-items:center;">
        <div class="az-wheel-track" id="wh-track"></div>
        ${betControl('wh-bet', 15)}
        <button id="wh-spin" class="az-btn az-btn-block">🎡 Glücksrad drehen</button>
        <div class="az-result-banner" id="wh-banner">Triff dein Glück!</div>
      </div>`;
    const track = container.querySelector('#wh-track');
    const banner = container.querySelector('#wh-banner');
    function renderTrack(landed = -1) {
      track.innerHTML = engine.segments.map((m, i) => `<div class="az-wheel-seg ${i === landed ? 'az-landed' : ''}">${m}×</div>`).join('');
    }
    renderTrack();
    container.querySelector('#wh-spin').onclick = () => {
      const bet = readBet(container, 'wh-bet', ctx.wallet);
      if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins!', 'lose'); return; }
      ctx.playSound('spin');
      let ticks = 0;
      const iv = setInterval(() => {
        renderTrack(Math.floor(Math.random() * engine.segments.length));
        ticks++;
        if (ticks > 12) {
          clearInterval(iv);
          const r = engine.spin(bet);
          renderTrack(r.index);
          if (r.payout > bet) { ctx.wallet.award(r.payout); setBanner(banner, `${r.multiplier}× — Gewonnen! +${fmt(r.payout)}`, 'win'); ctx.playSound('win'); }
          else if (r.payout === bet) { ctx.wallet.award(r.payout); setBanner(banner, `${r.multiplier}× — Einsatz zurück.`, ''); }
          else { setBanner(banner, `${r.multiplier}× — Verloren.`, 'lose'); ctx.playSound('lose'); }
        }
      }, 90);
    };
  }

  root.CASINO_GAMES = [
    { id: 'slot', icon: '🎰', title: 'Spielautomat', render: renderSlot },
    { id: 'blackjack', icon: '🃏', title: 'Blackjack', render: renderBlackjack },
    { id: 'roulette', icon: '🎡', title: 'Roulette', render: renderRoulette },
    { id: 'videopoker', icon: '🂡', title: 'Video Poker', render: renderVideoPoker },
    { id: 'baccarat', icon: '🎴', title: 'Baccarat', render: renderBaccarat },
    { id: 'craps', icon: '🎲', title: 'Craps', duel: true, render: renderCraps },
    { id: 'sicbo', icon: '🀄', title: 'Sic Bo', render: renderSicBo },
    { id: 'higherlower', icon: '🔀', title: 'Höher/Tiefer', duel: true, render: renderHigherLower },
    { id: 'coinflip', icon: '🪙', title: 'Münzwurf', duel: true, render: renderCoinFlip },
    { id: 'plinko', icon: '⚪', title: 'Plinko', render: renderPlinko },
    { id: 'wheel', icon: '🎯', title: 'Glücksrad', render: renderWheel }
  ];
})(typeof window !== 'undefined' ? window : globalThis);

// ---- src/ui/app.js ----
/**
 * ArcadeApp — the shared application shell.
 * Renders into either a floating Shadow DOM widget (browser extension /
 * Tampermonkey userscript) or a full page (standalone web app / PWA).
 * Owns the board-game tab, the Casino tab, the shared P2P connection and
 * the shared casino wallet.
 */
(function (root) {
  'use strict';

  const STATE_KEY = 'arcade_app_state_v5';

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

      this.activeTab = 'arcade'; // 'arcade' | 'casino'
      this.activeBoardGame = 'tictactoe';
      this.boardMode = 'ai'; // 'ai' | 'local' | 'p2p'
      this.activeCasinoGame = null;
      this.casinoDuelHandler = null;
      this.socialOpen = false;
      this.isCollapsed = false;

      this.ttt = new window.TicTacToeEngine();
      this.c4 = new window.Connect4Engine();
      this.chess = new window.ChessEngine();
      this.scores = { tictactoe: [0, 0], connect4: [0, 0] };

      this._bindP2P();
      this.wallet.onChange((bal) => {
        this.root.querySelectorAll('[data-wallet-badge]').forEach(el => {
          el.textContent = `${bal.toLocaleString('de-DE')} Coins`;
        });
      });
    }

    _bindP2P() {
      this.p2p.callbacks.onConnected = () => {
        this.updateSocialStatus('✅ Verbunden!');
        this.boardMode = 'p2p';
        this.resetActiveBoardGame();
        this.render();
      };
      this.p2p.callbacks.onDisconnected = () => {
        this.updateSocialStatus('Getrennt.');
        this.boardMode = 'ai';
        this.render();
      };
      this.p2p.callbacks.onError = (msg) => this.updateSocialStatus('❌ ' + msg);
      this.p2p.callbacks.onData = (data) => {
        if (!data || !data.type) return;
        if (data.type === 'HANDSHAKE') { this.updateSocialStatus(`✅ ${data.name || 'Verbunden'}`); return; }
        if (data.scope === 'board') { this._handleBoardData(data); return; }
        if (data.scope === 'casino' && this.casinoDuelHandler) { this.casinoDuelHandler(data); return; }
      };
    }

    updateSocialStatus(text) {
      const el = this.root.querySelector('#az-social-status');
      if (el) el.textContent = text;
    }

    mount() {
      this.render();
    }

    render() {
      const isFloating = this.mode === 'floating';
      this.root.innerHTML = `
        <div class="az-root ${isFloating ? 'az-floating-root' : 'az-fullpage-root'}">
          ${isFloating ? `<button id="az-pill" class="az-pill ${this.isCollapsed ? '' : 'az-hidden'}">🎮 Arcade</button>` : ''}
          <div id="az-window" class="az-window az-glass ${this.isCollapsed ? 'az-hidden' : ''}">
            <div id="az-header" class="az-header">
              <div class="az-text-title3">🎮 Arbeitszeitbetrug Arcade</div>
              <div class="az-flex az-gap-1">
                <button id="az-btn-social" class="az-btn az-btn-icon" title="Online spielen">🌐</button>
                <button id="az-btn-sound" class="az-btn az-btn-icon" title="Ton">${this.sound.muted ? '🔇' : '🔊'}</button>
                ${isFloating ? '<button id="az-btn-min" class="az-btn az-btn-icon" title="Minimieren">—</button>' : ''}
              </div>
            </div>

            <div id="az-social" class="az-card az-social-panel ${this.socialOpen ? '' : 'az-hidden'}">
              <div class="az-flex-between">
                <span class="az-text-headline">🌐 Online P2P (kein Server nötig)</span>
                <span id="az-social-status" class="az-text-footnote">${this.p2p.isConnected() ? '✅ Verbunden' : 'Offline'}</span>
              </div>
              <div class="az-flex az-gap-2" style="margin-top:8px;">
                <input id="az-username" class="az-input" style="flex:1;" maxlength="14" value="${this.username}" placeholder="Dein Name">
              </div>
              <div class="az-flex az-gap-2" style="margin-top:8px;">
                <button id="az-btn-host" class="az-btn az-btn-secondary az-btn-sm">PIN erstellen</button>
                <input id="az-pin-input" class="az-input" style="width:80px;" maxlength="4" placeholder="PIN">
                <button id="az-btn-join" class="az-btn az-btn-sm">Beitreten</button>
                <button id="az-btn-leave" class="az-btn az-btn-danger az-btn-sm ${this.p2p.isConnected() ? '' : 'az-hidden'}">Trennen</button>
              </div>
              <div id="az-pin-display" class="az-text-footnote" style="margin-top:6px;"></div>
            </div>

            <div class="az-segmented" style="margin: var(--az-space-2) var(--az-space-3) 0;">
              <button data-tab="arcade" class="${this.activeTab === 'arcade' ? 'az-active' : ''}">🎮 Arcade</button>
              <button data-tab="casino" class="${this.activeTab === 'casino' ? 'az-active' : ''}">🎰 Casino</button>
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
        r.querySelector('#az-btn-sound').textContent = this.sound.muted ? '🔇' : '🔊';
      };

      r.querySelector('#az-btn-social').onclick = () => { this.socialOpen = !this.socialOpen; this.render(); };

      r.querySelectorAll('[data-tab]').forEach(btn => {
        btn.onclick = () => { this.activeTab = btn.getAttribute('data-tab'); this.activeCasinoGame = null; this.render(); };
      });

      if (this.socialOpen) {
        r.querySelector('#az-username').oninput = (e) => { this.username = e.target.value; };
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
      const win = this.root.querySelector('#az-window');
      const header = this.root.querySelector('#az-header');
      const hostEl = this.hostElement;
      if (!win || !header || !hostEl) return;
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

    // ==========================================================
    // ARCADE TAB (Board games)
    // ==========================================================
    _renderBody() {
      const body = this.root.querySelector('#az-body');
      if (this.activeTab === 'arcade') this._renderArcade(body);
      else this._renderCasino(body);
    }

    _renderArcade(body) {
      const games = [
        { id: 'tictactoe', icon: '❌⭕', label: 'Tic-Tac-Toe' },
        { id: 'connect4', icon: '🔴🟡', label: '4 Gewinnt' },
        { id: 'chess', icon: '♟️', label: 'Schach' }
      ];
      body.innerHTML = `
        <div class="az-flex-col az-gap-3">
          <div class="az-segmented">
            ${games.map(g => `<button data-game="${g.id}" class="${this.activeBoardGame === g.id ? 'az-active' : ''}">${g.icon} ${g.label}</button>`).join('')}
          </div>
          <div class="az-flex-between">
            <div class="az-segmented" style="max-width:220px;">
              <button data-mode="ai" class="${this.boardMode === 'ai' ? 'az-active' : ''}">🤖 KI</button>
              <button data-mode="local" class="${this.boardMode === 'local' ? 'az-active' : ''}">👥 Lokal</button>
              <button data-mode="p2p" class="${this.boardMode === 'p2p' ? 'az-active' : ''}" ${this.p2p.isConnected() ? '' : 'disabled'}>🌐 Online</button>
            </div>
            <button id="az-board-reset" class="az-btn az-btn-secondary az-btn-sm">🔄 Neu</button>
          </div>
          <div id="az-board-status" class="az-result-banner"></div>
          <div id="az-board-arena" class="az-flex" style="justify-content:center;"></div>
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
        arena.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,56px);gap:6px;">
          ${this.ttt.board.map((v, i) => `<div data-i="${i}" class="az-card" style="width:56px;height:56px;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;cursor:pointer;${this.ttt.winningLine && this.ttt.winningLine.includes(i) ? 'background:rgba(52,199,89,0.25);' : ''}color:${v === 'X' ? 'var(--az-blue)' : 'var(--az-red)'}">${v}</div>`).join('')}
        </div>`;
        arena.querySelectorAll('[data-i]').forEach(cell => cell.onclick = () => this._playTTT(parseInt(cell.getAttribute('data-i'), 10)));
        status.textContent = this._boardStatusText('ttt');
      } else if (this.activeBoardGame === 'connect4') {
        arena.innerHTML = `<div class="az-flex-col az-gap-1" style="align-items:center;">
          <div style="display:grid;grid-template-columns:repeat(7,32px);gap:3px;">
            ${Array(7).fill(0).map((_, c) => `<button data-c="${c}" class="az-btn az-btn-plain" style="min-height:24px;padding:0;">▼</button>`).join('')}
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,32px);gap:3px;background:var(--az-grouped-bg);padding:6px;border-radius:10px;">
            ${this.c4.board.flat().map((v, i) => `<div class="az-card" style="width:32px;height:32px;border-radius:50%;padding:0;background:${v === 1 ? '#06b6d4' : v === 2 ? '#f43f5e' : 'var(--az-bg)'}"></div>`).join('')}
          </div>
        </div>`;
        arena.querySelectorAll('[data-c]').forEach(btn => btn.onclick = () => this._playC4(parseInt(btn.getAttribute('data-c'), 10)));
        status.textContent = this._boardStatusText('c4');
      } else {
        arena.innerHTML = `<div style="display:grid;grid-template-columns:repeat(8,32px);">
          ${this.chess.board.flat().map((p, i) => {
            const r = Math.floor(i / 8), c = i % 8;
            const light = (r + c) % 2 === 0;
            const isSel = this.chess.selected && this.chess.selected.r === r && this.chess.selected.c === c;
            const isValid = this.chess.validMoves.some(m => m.r === r && m.c === c);
            return `<div data-r="${r}" data-c="${c}" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;background:${isSel ? 'var(--az-blue)' : isValid ? 'rgba(52,199,89,0.4)' : light ? '#e5e5ea' : '#3a3a3c'};color:${this.chess.isWhite(p) ? '#0a84ff' : '#ff453a'}">${p}</div>`;
          }).join('')}
        </div>`;
        arena.querySelectorAll('[data-r]').forEach(cell => cell.onclick = () => this._playChess(parseInt(cell.getAttribute('data-r'), 10), parseInt(cell.getAttribute('data-c'), 10)));
        status.textContent = this._boardStatusText('chess');
      }
    }

    _boardStatusText(game) {
      if (game === 'ttt') {
        if (this.ttt.winner) return this.ttt.winner === 'TIE' ? 'Unentschieden!' : `${this.ttt.winner} gewinnt! 🎉`;
        return this.boardMode === 'p2p' ? (this.isMyTurn ? 'Du bist dran' : 'Gegner ist dran') : `${this.ttt.turn} ist dran`;
      }
      if (game === 'c4') {
        if (this.c4.winner) return this.c4.winner === 'TIE' ? 'Unentschieden!' : `Spieler ${this.c4.winner} gewinnt! 🎉`;
        return this.boardMode === 'p2p' ? (this.isMyTurn ? 'Du bist dran' : 'Gegner ist dran') : `Spieler ${this.c4.turn} ist dran`;
      }
      if (this.chess.winner) return `${this.chess.winner} gewinnt! ♚🎉`;
      return this.boardMode === 'p2p' ? (this.isMyTurn ? 'Du bist dran' : 'Gegner ist dran') : (this.chess.turn === 'w' ? 'Weiß ist dran' : 'Schwarz ist dran');
    }

    _playTTT(i, fromRemote = false) {
      if (this.ttt.winner) return;
      if (this.boardMode === 'p2p' && !fromRemote && !this.isMyTurn) return;
      if (!this.ttt.move(i)) return;
      this.sound.play('move');
      if (this.boardMode === 'p2p' && !fromRemote) { this.p2p.send({ scope: 'board', type: 'MOVE', game: 'ttt', i }); this.isMyTurn = false; }
      else if (this.boardMode === 'p2p' && fromRemote) this.isMyTurn = true;
      this._renderBoardArena();
      if (this.ttt.winner) { this.sound.play(this.ttt.winner === 'TIE' ? 'click' : 'win'); return; }
      if (this.boardMode === 'ai' && this.ttt.turn === 'O') {
        setTimeout(() => {
          const ai = this.ttt.getAIMove('hard');
          if (ai !== null) { this.ttt.move(ai); this.sound.play('move'); this._renderBoardArena(); if (this.ttt.winner) this.sound.play(this.ttt.winner === 'TIE' ? 'click' : 'lose'); }
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
      if (this.c4.winner) { this.sound.play(this.c4.winner === 'TIE' ? 'click' : 'win'); return; }
      if (this.boardMode === 'ai' && this.c4.turn === 2) {
        setTimeout(() => {
          const ai = this.c4.getAIMove();
          if (ai !== null) { this.c4.drop(ai); this.sound.play('move'); this._renderBoardArena(); if (this.c4.winner) this.sound.play(this.c4.winner === 'TIE' ? 'click' : 'lose'); }
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
        if (this.chess.winner) this.sound.play('win');
        return;
      }
      if (this.chess.selected && this.chess.validMoves.some(m => m.r === r && m.c === c)) {
        const from = this.chess.selected;
        this.chess.move(from.r, from.c, r, c);
        this.sound.play('move');
        if (this.boardMode === 'p2p') { this.p2p.send({ scope: 'board', type: 'MOVE', game: 'chess', fromR: from.r, fromC: from.c, r, c }); this.isMyTurn = false; }
        this._renderBoardArena();
        if (this.chess.winner) { this.sound.play('win'); return; }
        if (this.boardMode === 'ai' && this.chess.turn === 'b') {
          setTimeout(() => {
            const m = this.chess.getAIMove();
            if (m) { this.chess.move(m.from.r, m.from.c, m.to.r, m.to.c); this.sound.play('move'); this._renderBoardArena(); if (this.chess.winner) this.sound.play('lose'); }
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
            <span class="az-text-headline">💰 Guthaben</span>
            <span class="az-badge az-badge-gold" data-wallet-badge>${this.wallet.balance.toLocaleString('de-DE')} Coins</span>
          </div>
          <div class="az-grid-3">
            ${window.CASINO_GAMES.map(g => `<div class="az-game-tile" data-casino="${g.id}"><div class="az-tile-icon">${g.icon}</div><div class="az-tile-label">${g.title}</div></div>`).join('')}
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
            <button id="az-casino-back" class="az-btn az-btn-plain">← Zurück</button>
            <span class="az-badge az-badge-gold" data-wallet-badge>${this.wallet.balance.toLocaleString('de-DE')} Coins</span>
          </div>
          <div class="az-text-title3" style="text-align:center;">${game.icon} ${game.title}</div>
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
  }

  root.ArcadeApp = ArcadeApp;
})(typeof window !== 'undefined' ? window : globalThis);

// ---- src/entry-floating.js ----
/**
 * Floating widget bootstrap — shared by the browser extension content
 * script and the Tampermonkey userscript. Mounts the ArcadeApp into an
 * isolated Shadow DOM host fixed to the top-right corner of any page.
 */
(function () {
  'use strict';

  const HOST_ID = 'arbeitszeitbetrug-arcade-host';
  const STATE_KEY = 'arcade_app_state_v5';

  function loadState(cb) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([STATE_KEY], (res) => cb((res && res[STATE_KEY]) || null));
    } else {
      try {
        const raw = localStorage.getItem(STATE_KEY);
        cb(raw ? JSON.parse(raw) : null);
      } catch (e) { cb(null); }
    }
  }

  function mount() {
    if (document.getElementById(HOST_ID)) return;
    const parent = document.body || document.documentElement;
    if (!parent) return;

    const host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText = `
      position: fixed !important; top: 16px !important; right: 16px !important;
      z-index: 2147483647 !important; width: auto !important; height: auto !important;
      margin: 0 !important; padding: 0 !important; border: none !important; background: transparent !important;
    `;
    parent.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = window.ARCADE_THEME_CSS + `
      .az-floating-root { position: relative; }
      .az-pill {
        display:flex; align-items:center; gap:8px; min-height:44px; padding:0 16px;
        background: var(--az-blue); color:#fff; border:none; border-radius:24px; font-weight:700; font-size:13px;
        cursor:pointer; box-shadow:0 8px 20px rgba(0,0,0,0.3);
      }
      .az-pill.az-hidden { display:none !important; }
      .az-window { width: 380px; max-height: 620px; border-radius: 20px; box-shadow: 0 24px 48px rgba(0,0,0,0.35); display:flex; flex-direction:column; overflow:hidden; }
      .az-window.az-hidden { display:none !important; }
      .az-header { display:flex; align-items:center; justify-content:space-between; padding: 12px 16px; cursor:move; border-bottom:1px solid var(--az-separator); }
      .az-social-panel { margin: 8px 16px 0; }
    `;
    shadow.appendChild(style);

    const container = document.createElement('div');
    shadow.appendChild(container);

    const app = new window.ArcadeApp(container, { mode: 'floating' });
    app.hostElement = host;

    loadState((saved) => {
      if (saved) {
        if (typeof saved.isCollapsed === 'boolean') app.isCollapsed = saved.isCollapsed;
        if (saved.activeTab) app.activeTab = saved.activeTab;
        if (saved.username) app.username = saved.username;
        if (saved.left && saved.top) {
          host.style.right = 'auto';
          host.style.left = saved.left;
          host.style.top = saved.top;
        }
      }
      app.mount();
    });

    app._persist = function () {
      const rect = host.getBoundingClientRect();
      const state = {
        isCollapsed: app.isCollapsed,
        activeTab: app.activeTab,
        username: app.username,
        left: host.style.left || rect.left + 'px',
        top: host.style.top || rect.top + 'px'
      };
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [STATE_KEY]: state });
      } else {
        try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) {}
      }
    };

    document.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        app.isCollapsed = !app.isCollapsed;
        app.render();
        app._persist();
      }
    });

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((req) => {
        if (req && req.action === 'REOPEN_ARCADE') {
          app.isCollapsed = false;
          host.style.display = 'block';
          app.render();
          app._persist();
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();

})();
