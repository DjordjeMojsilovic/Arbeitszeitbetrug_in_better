/**
 * Inline SVG icon set — replaces all emoji in the UI with line icons that
 * match the SF Symbols weight/aesthetic described in design.md (stroke
 * icons, consistent weight, no second display face). 24x24 viewBox,
 * currentColor stroke so icons inherit text color and adapt to the theme.
 */
(function (root) {
  'use strict';

  const W = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

  const PATHS = {
    controller: `<rect x="2.5" y="8" width="19" height="10" rx="5" ${W}/><line x1="7" y1="11.2" x2="7" y2="14.8" ${W}/><line x1="5.2" y1="13" x2="8.8" y2="13" ${W}/><circle cx="15.5" cy="11.7" r="1" fill="currentColor" stroke="none"/><circle cx="18" cy="14.2" r="1" fill="currentColor" stroke="none"/>`,
    globe: `<circle cx="12" cy="12" r="9" ${W}/><ellipse cx="12" cy="12" rx="4" ry="9" ${W}/><line x1="3" y1="12" x2="21" y2="12" ${W}/>`,
    speaker: `<path d="M4 9v6h4l5 4V5L8 9H4z" ${W}/><path d="M17 9.5a4 4 0 0 1 0 5" ${W}/>`,
    speakerMute: `<path d="M4 9v6h4l5 4V5L8 9H4z" ${W}/><line x1="16" y1="10" x2="21" y2="15" ${W}/><line x1="21" y1="10" x2="16" y2="15" ${W}/>`,
    minus: `<line x1="5" y1="12" x2="19" y2="12" ${W}/>`,
    close: `<line x1="6" y1="6" x2="18" y2="18" ${W}/><line x1="18" y1="6" x2="6" y2="18" ${W}/>`,
    chevronLeft: `<polyline points="15 5 8 12 15 19" ${W}/>`,
    grid: `<rect x="3" y="3" width="18" height="18" rx="2" ${W}/><line x1="9" y1="3" x2="9" y2="21" ${W}/><line x1="15" y1="3" x2="15" y2="21" ${W}/><line x1="3" y1="9" x2="21" y2="9" ${W}/><line x1="3" y1="15" x2="21" y2="15" ${W}/>`,
    discs: `<circle cx="8" cy="9" r="3.4" ${W}/><circle cx="16" cy="9" r="3.4" ${W}/><circle cx="12" cy="16" r="3.4" ${W}/>`,
    crown: `<path d="M4 18h16l-1.4-8-3.6 3-3-5.5-3 5.5-3.6-3L4 18z" ${W}/>`,
    bot: `<rect x="5" y="9" width="14" height="10" rx="3" ${W}/><line x1="12" y1="5.5" x2="12" y2="9" ${W}/><circle cx="12" cy="4" r="1.2" fill="currentColor" stroke="none"/><circle cx="9.2" cy="14" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.8" cy="14" r="1.1" fill="currentColor" stroke="none"/>`,
    users: `<circle cx="9" cy="8" r="3" ${W}/><path d="M3.5 19c0-3.3 2.5-5.5 5.5-5.5S14.5 15.7 14.5 19" ${W}/><circle cx="17" cy="9" r="2.4" ${W}/><path d="M15.8 13.2c2.4.4 3.8 2.2 3.8 5" ${W}/>`,
    refresh: `<path d="M4 12a8 8 0 0 1 13.7-5.7L20 8" ${W}/><polyline points="20 3 20 8 15 8" ${W}/><path d="M20 12a8 8 0 0 1-13.7 5.7L4 16" ${W}/><polyline points="4 21 4 16 9 16" ${W}/>`,
    dice: `<rect x="3.5" y="3.5" width="17" height="17" rx="4" ${W}/><circle cx="8.3" cy="8.3" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.7" cy="8.3" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="8.3" cy="15.7" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.7" cy="15.7" r="1.1" fill="currentColor" stroke="none"/>`,
    cards: `<rect x="3" y="6" width="12" height="15" rx="2" ${W}/><path d="M8.5 6 15 3.3a1 1 0 0 1 1.3.6l4 9.6a1 1 0 0 1-.6 1.3L17 16" ${W}/>`,
    target: `<circle cx="12" cy="12" r="8.5" ${W}/><circle cx="12" cy="12" r="4.5" ${W}/><circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none"/>`,
    coin: `<circle cx="12" cy="12" r="8.5" ${W}/><path d="M9.3 15.2c0 1 1.1 1.8 2.7 1.8s2.7-.8 2.7-1.8-1.1-1.4-2.7-1.7-2.7-.7-2.7-1.7 1.1-1.8 2.7-1.8 2.7.8 2.7 1.8" ${W}/>`,
    slot: `<rect x="4" y="5" width="16" height="14" rx="3" ${W}/><line x1="9.3" y1="7" x2="9.3" y2="17" ${W}/><line x1="14.7" y1="7" x2="14.7" y2="17" ${W}/>`,
    wheel: `<circle cx="12" cy="12" r="8.5" ${W}/><line x1="12" y1="3.5" x2="12" y2="20.5" ${W}/><line x1="3.5" y1="12" x2="20.5" y2="12" ${W}/><line x1="6" y1="6" x2="18" y2="18" ${W}/><line x1="18" y1="6" x2="6" y2="18" ${W}/>`,
    drop: `<circle cx="6" cy="5" r="1.6" fill="currentColor" stroke="none"/><path d="M12 3v6" ${W}/><path d="M6 12h12" ${W}/><path d="M4 15.5h16l-1.6 4a2 2 0 0 1-1.9 1.5H7.5a2 2 0 0 1-1.9-1.5L4 15.5z" ${W}/>`,
    trophy: `<path d="M7 4h10v5a5 5 0 0 1-10 0V4z" ${W}/><path d="M7 5H4a3 3 0 0 0 3 4" ${W}/><path d="M17 5h3a3 3 0 0 1-3 4" ${W}/><line x1="12" y1="14" x2="12" y2="18" ${W}/><line x1="8.5" y1="20.5" x2="15.5" y2="20.5" ${W}/><line x1="12" y1="18" x2="12" y2="20.5" ${W}/>`,
    link: `<path d="M9.5 14.5 14.5 9.5" ${W}/><path d="M11 7l1.5-1.5a3.5 3.5 0 0 1 5 5L16 12" ${W}/><path d="M13 17l-1.5 1.5a3.5 3.5 0 0 1-5-5L8 12" ${W}/>`,
    check: `<polyline points="5 13 10 18 19 7" ${W}/>`,
    copy: `<rect x="9" y="9" width="11" height="11" rx="2" ${W}/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" ${W}/>`,
    person: `<circle cx="12" cy="8" r="3.4" ${W}/><path d="M4.8 19.5c0-3.7 2.9-6 7.2-6s7.2 2.3 7.2 6" ${W}/>`,
    plus: `<line x1="12" y1="5" x2="12" y2="19" ${W}/><line x1="5" y1="12" x2="19" y2="12" ${W}/>`,
    wallet: `<rect x="3" y="6" width="18" height="13" rx="2.5" ${W}/><path d="M3 9.5h18" ${W}/><circle cx="16.5" cy="14" r="1.1" fill="currentColor" stroke="none"/>`,
    briefcase: `<rect x="3" y="8" width="18" height="12" rx="2" ${W}/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" ${W}/><line x1="3" y1="13" x2="21" y2="13" ${W}/>`,
    cherry: `<circle cx="8.5" cy="17" r="3" ${W}/><circle cx="15" cy="18" r="3" ${W}/><path d="M8.5 14 11 5" ${W}/><path d="M15 15 11 5" ${W}/>`,
    diamond: `<path d="M4 10 9 4h6l5 6-10 11z" ${W}/><path d="M4 10h16" ${W}/>`,
    star: `<path d="M12 3.5 14.5 9l6 .8-4.4 4 1.2 5.9-5.3-3-5.3 3 1.2-5.9-4.4-4 6-.8z" ${W}/>`,
    rocket: `<path d="M12 3c2.8 1.6 4.5 4.6 4.5 8.5 0 2-.5 3.7-1.4 5.2l-3.1 2.8-3.1-2.8C7.9 15.2 7.4 13.5 7.4 11.5 7.4 7.6 9.2 4.6 12 3z" ${W}/><circle cx="12" cy="10.5" r="1.5" ${W}/><path d="M8.5 16.5 6 20l3.7-1.3" ${W}/><path d="M15.5 16.5 18 20l-3.7-1.3" ${W}/>`
  };

  function icon(name, opts = {}) {
    const size = opts.size || 18;
    const cls = opts.class ? ` class="${opts.class}"` : '';
    const body = PATHS[name] || '';
    return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" style="display:block;flex-shrink:0;">${body}</svg>`;
  }

  root.AZIcon = icon;
})(typeof window !== 'undefined' ? window : globalThis);
