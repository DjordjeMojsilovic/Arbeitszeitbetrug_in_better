/**
 * Peer-to-peer result ledger — gives the app a "small blockchain network"
 * feel without any server: every match result is appended to a local,
 * hash-chained log (like a block header: index, timestamp, previous hash,
 * own hash). When two peers connect over WebRTC they exchange everything
 * they know — their own chain plus every other chain they have picked up
 * from previous connections — and merge it in after verifying the hash
 * chain. Meet enough people and your local "network view" keeps growing,
 * exactly like gossip propagation in a real P2P network. There is still
 * no mining or consensus: each device's chain is authoritative for that
 * device's own results, the "chain" only makes tampering with your own
 * history detectable.
 */
(function (root) {
  'use strict';

  const GENESIS_PREV = '0'.repeat(64);
  const DEVICE_KEY = 'arcade_device_id_v1';
  const LEDGER_KEY = 'arcade_ledger_v1';
  const NETWORK_KEY = 'arcade_network_ledger_v1';

  function storageGet(key) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([key], (res) => resolve(res ? res[key] : undefined));
      } else {
        try { const raw = localStorage.getItem(key); resolve(raw ? JSON.parse(raw) : undefined); }
        catch (e) { resolve(undefined); }
      }
    });
  }

  function storageSet(key, value) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [key]: value }, () => resolve());
      } else {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
        resolve();
      }
    });
  }

  async function sha256Hex(input) {
    try {
      const enc = new TextEncoder().encode(input);
      const buf = await crypto.subtle.digest('SHA-256', enc);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // Fallback for environments without SubtleCrypto — still deterministic,
      // just not cryptographically strong. Good enough for a fun tamper-hint.
      let h1 = 0x811c9dc5, h2 = 0x01000193;
      for (let i = 0; i < input.length; i++) {
        const c = input.charCodeAt(i);
        h1 = (h1 ^ c) * 16777619 >>> 0;
        h2 = (h2 + c) * 2654435761 >>> 0;
      }
      return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(4).slice(0, 64);
    }
  }

  function randomDeviceId() {
    const bytes = new Uint8Array(8);
    (crypto.getRandomValues ? crypto : { getRandomValues: (a) => a.forEach((_, i) => a[i] = Math.floor(Math.random() * 256)) }).getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function getOrCreateDeviceId() {
    let id = await storageGet(DEVICE_KEY);
    if (!id) { id = randomDeviceId(); await storageSet(DEVICE_KEY, id); }
    return id;
  }

  async function blockHash(block) {
    return sha256Hex(`${block.index}|${block.ts}|${block.game}|${block.result}|${block.delta}|${block.prevHash}`);
  }

  async function isChainValid(chain) {
    if (!Array.isArray(chain) || chain.length === 0) return false;
    if (chain[0].prevHash !== GENESIS_PREV || chain[0].index !== 0) return false;
    for (let i = 0; i < chain.length; i++) {
      const b = chain[i];
      if (i > 0 && b.prevHash !== chain[i - 1].hash) return false;
      const expected = await blockHash(b);
      if (expected !== b.hash) return false;
    }
    return true;
  }

  class PlayerLedger {
    constructor(deviceId, name, chain) {
      this.deviceId = deviceId;
      this.name = name;
      this.chain = chain || [];
    }

    static async load(defaultName) {
      const deviceId = await getOrCreateDeviceId();
      const saved = await storageGet(LEDGER_KEY);
      if (saved && saved.deviceId === deviceId) {
        return new PlayerLedger(deviceId, saved.name || defaultName, saved.chain || []);
      }
      return new PlayerLedger(deviceId, defaultName, []);
    }

    async persist() {
      await storageSet(LEDGER_KEY, { deviceId: this.deviceId, name: this.name, chain: this.chain });
    }

    setName(name) { this.name = name; }

    async addResult(game, result, delta) {
      const prev = this.chain[this.chain.length - 1];
      const block = {
        index: this.chain.length,
        ts: Date.now(),
        game,
        result, // 'win' | 'lose' | 'tie' | 'push'
        delta: delta || 0,
        prevHash: prev ? prev.hash : GENESIS_PREV
      };
      block.hash = await blockHash(block);
      this.chain.push(block);
      await this.persist();
      return block;
    }
  }

  class NetworkLedger {
    constructor() {
      this.peers = {}; // deviceId -> { name, chain }
    }

    async load() {
      const saved = await storageGet(NETWORK_KEY);
      this.peers = saved || {};
    }

    async persist() {
      await storageSet(NETWORK_KEY, this.peers);
    }

    setLocal(deviceId, name, chain) {
      this.peers[deviceId] = { name, chain };
    }

    exportPayload() {
      return this.peers;
    }

    /** Merge a peer's known chains in, keeping the longest valid chain per device. */
    async mergeAll(payload) {
      let learned = 0, updated = 0;
      if (!payload || typeof payload !== 'object') return { learned, updated };
      for (const deviceId of Object.keys(payload)) {
        const incoming = payload[deviceId];
        if (!incoming || !Array.isArray(incoming.chain) || !incoming.chain.length) continue;
        const existing = this.peers[deviceId];
        if (existing && existing.chain.length >= incoming.chain.length) continue;
        if (!(await isChainValid(incoming.chain))) continue;
        this.peers[deviceId] = { name: incoming.name || 'Unbekannt', chain: incoming.chain };
        if (existing) updated++; else learned++;
      }
      if (learned || updated) await this.persist();
      return { learned, updated };
    }

    buildLeaderboard(myDeviceId) {
      const rows = Object.keys(this.peers).map((deviceId) => {
        const { name, chain } = this.peers[deviceId];
        let netCoins = 0, wins = 0, losses = 0;
        for (const b of chain) {
          netCoins += b.delta || 0;
          if (b.result === 'win') wins++;
          else if (b.result === 'lose') losses++;
        }
        const lastHash = chain.length ? chain[chain.length - 1].hash : '';
        return {
          deviceId, name: name || 'Unbekannt', isMe: deviceId === myDeviceId,
          blocks: chain.length, netCoins, wins, losses,
          fingerprint: lastHash.slice(0, 8) || deviceId.slice(0, 8)
        };
      });
      rows.sort((a, b) => b.netCoins - a.netCoins || b.wins - a.wins);
      return rows;
    }
  }

  root.PlayerLedger = PlayerLedger;
  root.NetworkLedger = NetworkLedger;
  root.LedgerCrypto = { sha256Hex, isChainValid };
})(typeof window !== 'undefined' ? window : globalThis);
