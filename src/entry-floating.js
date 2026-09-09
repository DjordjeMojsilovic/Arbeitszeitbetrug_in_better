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
