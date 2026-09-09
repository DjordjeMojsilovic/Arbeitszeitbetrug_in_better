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
      this._retriedHost = false;
      this._retriedJoin = false;
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

    /** Transient signalling hiccups (the free PeerJS cloud broker occasionally
     * drops the initial handshake) — worth one silent retry before we bother
     * the user with an error. */
    _isTransient(err) {
      return err && ['network', 'socket-error', 'socket-closed', 'server-error'].includes(err.type);
    }

    _describe(err, fallback) {
      if (!err) return fallback;
      const type = err.type ? ` [${err.type}]` : '';
      return `${err.message || fallback}${type}`;
    }

    hostRoom(username) {
      this.disconnect();
      this.isHost = true;
      this.username = username || this.username;
      this.roomCode = this.generatePin();
      this._retriedHost = false;
      this._startHostPeer();
      return this.roomCode;
    }

    _startHostPeer() {
      const PeerClass = this.getPeerClass();
      if (!PeerClass) { this._error('PeerJS ist nicht geladen.'); return; }

      try {
        this.peer = new PeerClass(NAMESPACE + this.roomCode, this._iceConfig());
        this._watchPeerLifecycle();
        this.peer.on('connection', (connection) => {
          this.conn = connection;
          this._bind();
        });
        this.peer.on('error', (err) => {
          if (err && err.type === 'unavailable-id') {
            // Someone already holds this PIN — pick a fresh one and retry.
            this.roomCode = this.generatePin();
            this._startHostPeer();
          } else if (this._isTransient(err) && !this._retriedHost) {
            // Keep the same PIN — it may already be visible to the other player.
            this._retriedHost = true;
            setTimeout(() => this._startHostPeer(), 1200);
          } else {
            this._error(this._describe(err, 'Verbindungsfehler beim Erstellen des Raums'));
          }
        });
      } catch (e) {
        this._error('WebRTC Peer konnte nicht gestartet werden: ' + e.message);
      }
    }

    joinRoom(code, username) {
      this.disconnect();
      this.isHost = false;
      this.username = username || this.username;
      this.roomCode = (code || '').trim();
      this._retriedJoin = false;
      this._startJoinPeer();
    }

    _startJoinPeer() {
      const PeerClass = this.getPeerClass();
      if (!PeerClass) { this._error('PeerJS ist nicht geladen.'); return; }

      try {
        this.peer = new PeerClass(this._iceConfig());
        this._watchPeerLifecycle();
        this.peer.on('open', () => {
          this.conn = this.peer.connect(NAMESPACE + this.roomCode, { reliable: true });
          this._bind();
        });
        this.peer.on('error', (err) => {
          if (err && err.type === 'peer-unavailable') {
            this._error('PIN nicht gefunden oder Host offline.');
          } else if (this._isTransient(err) && !this._retriedJoin) {
            this._retriedJoin = true;
            setTimeout(() => this._startJoinPeer(), 1200);
          } else {
            this._error(this._describe(err, 'Verbindungsfehler beim Beitreten'));
          }
        });
      } catch (e) {
        this._error('Verbindung zum Raum fehlgeschlagen: ' + e.message);
      }
    }

    /** Auto-reconnect if the signalling socket drops after the peer was
     * already registered — this does not affect an established game
     * connection, only the ability to accept a *new* incoming connection. */
    _watchPeerLifecycle() {
      this.peer.on('disconnected', () => {
        if (this.peer && !this.peer.destroyed) this.peer.reconnect();
      });
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
      this.conn.on('error', (err) => this._error(this._describe(err, 'Netzwerkverbindung unterbrochen.')));
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
