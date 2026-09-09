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
