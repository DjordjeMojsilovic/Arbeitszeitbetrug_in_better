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
  .az-root .az-hidden { display: none !important; }

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

  /* Icon buttons & generic controls */
  .az-icon-btn { display:flex; align-items:center; justify-content:center; }
  .az-btn .az-icon-inline { margin-right: 2px; }

  /* Responsive board grids — scale with container width instead of fixed px */
  .az-board-wrap { width: 100%; display: flex; justify-content: center; }
  .az-board-wrap > * { width: 100%; display: flex; justify-content: center; }
  .az-ttt-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; width: 100%; max-width: 260px; aspect-ratio: 1; }
  .az-ttt-cell {
    background: var(--az-fill); border-radius: var(--az-radius-sm);
    display: flex; align-items: center; justify-content: center;
    font-size: clamp(20px, 8vw, 30px); font-weight: 800; cursor: pointer;
    aspect-ratio: 1;
  }
  .az-ttt-cell.az-win { background: rgba(52,199,89,0.25); }

  .az-c4-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; max-width: 320px; }
  .az-c4-drops { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; width: 100%; }
  .az-c4-drop-btn { min-height: 28px; background: transparent; border: none; color: var(--az-secondary-label); cursor: pointer; display:flex; align-items:center; justify-content:center; border-radius: 6px; }
  .az-c4-drop-btn:hover { background: var(--az-fill); color: var(--az-label); }
  .az-c4-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; width: 100%; background: var(--az-grouped-bg); padding: 6px; border-radius: var(--az-radius-sm); }
  .az-c4-cell { aspect-ratio: 1; border-radius: 50%; background: var(--az-bg); border: 1px solid var(--az-separator); }
  .az-c4-cell.az-p1 { background: var(--az-blue); }
  .az-c4-cell.az-p2 { background: var(--az-red); }

  .az-chess-grid { display: grid; grid-template-columns: repeat(8, 1fr); width: 100%; max-width: 320px; aspect-ratio: 1; border-radius: 8px; overflow: hidden; border: 1px solid var(--az-separator); }
  .az-chess-cell { display: flex; align-items: center; justify-content: center; font-size: clamp(14px, 4.4vw, 22px); cursor: pointer; aspect-ratio: 1; }
  .az-chess-cell.az-light { background: #e5e5ea; }
  .az-chess-cell.az-dark { background: #48484a; }
  .az-chess-cell.az-selected { background: var(--az-blue) !important; }
  .az-chess-cell.az-valid { background: rgba(52,199,89,0.45) !important; }
  .az-chess-piece-w { color: #0a84ff; }
  .az-chess-piece-b { color: #ff453a; }

  /* Leaderboard */
  .az-leaderboard-row {
    display: flex; align-items: center; gap: var(--az-space-2);
    padding: var(--az-space-2); border-radius: var(--az-radius-sm); background: var(--az-fill);
  }
  .az-leaderboard-row.az-me { border: 1.5px solid var(--az-blue); }
  .az-lb-rank { width: 22px; text-align: center; font-weight: 800; color: var(--az-secondary-label); flex-shrink: 0; }
  .az-lb-info { flex: 1; min-width: 0; }
  .az-lb-name { font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .az-lb-meta { font-size: 11px; color: var(--az-secondary-label); font-family: 'SF Mono', ui-monospace, monospace; }
  .az-lb-score { font-weight: 800; font-size: 15px; flex-shrink: 0; }
  .az-lb-score.az-positive { color: var(--az-green); }
  .az-lb-score.az-negative { color: var(--az-red); }

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
