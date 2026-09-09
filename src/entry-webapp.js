/**
 * Standalone web-app bootstrap — mounts the same ArcadeApp full-page,
 * for the installable PWA build. No Shadow DOM needed since this page
 * has no host-site styles to isolate from.
 */
(function () {
  'use strict';

  function mount() {
    const container = document.getElementById('app');
    if (!container) return;
    const style = document.createElement('style');
    style.textContent = window.ARCADE_THEME_CSS + `
      html, body { height: 100%; margin: 0; background: var(--az-grouped-bg, #F2F2F7); }
      .az-fullpage-root { min-height: 100vh; display: flex; align-items: stretch; justify-content: center; }
      .az-window { width: 100%; max-width: 560px; margin: 0 auto; min-height: 100vh; border-radius: 0; box-shadow: none; display: flex; flex-direction: column; }
      @media (min-width: 620px) {
        .az-fullpage-root { align-items: center; padding: 24px 0; }
        .az-window { min-height: 80vh; max-height: 880px; border-radius: 24px; box-shadow: 0 30px 80px rgba(0,0,0,0.25); }
      }
      .az-header { display:flex; align-items:center; justify-content:space-between; padding: 16px 20px; border-bottom: 1px solid var(--az-separator); }
      .az-social-panel { margin: 12px 20px 0; }
    `;
    document.head.appendChild(style);

    const app = new window.ArcadeApp(container, { mode: 'fullpage' });
    app.mount();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
