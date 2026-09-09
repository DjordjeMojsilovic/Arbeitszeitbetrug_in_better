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
