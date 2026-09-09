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
