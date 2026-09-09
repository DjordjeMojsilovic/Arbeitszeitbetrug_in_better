/**
 * Casino tab: registry of per-game panels. Each panel renders itself into a
 * container element using the shared engines from core/casino-games.js and
 * settles bets through the shared CasinoWallet. Games marked `duel: true`
 * additionally support a peer-to-peer "vs. friend" mode over the same
 * WebRTC connection used by the Arcade tab. Every settled round is also
 * written to the local result ledger via ctx.recordResult so it shows up
 * on the Rangliste (leaderboard) tab.
 */
(function (root) {
  'use strict';

  const Icon = (name, opts) => window.AZIcon(name, opts);

  function fmt(n) { return n.toLocaleString('de-DE'); }

  /** Records a settled round to the ledger: positive/negative/zero net change. */
  function settle(ctx, bet, payout) {
    const delta = payout - bet;
    if (delta > 0) ctx.recordResult('win', delta);
    else if (delta < 0) ctx.recordResult('lose', delta);
    else ctx.recordResult('tie', 0);
  }

  function cardHtml(card, opts = {}) {
    if (!card || opts.faceDown) return `<div class="az-playing-card az-face-down"></div>`;
    return `<div class="az-playing-card ${card.red ? 'az-red' : ''} ${opts.held ? 'az-held' : ''}">
      <div>${card.rank}</div><div>${card.suit}</div>
    </div>`;
  }

  const PIP_LAYOUTS = {
    1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
  };
  function dieHtml(v) {
    const active = new Set(PIP_LAYOUTS[v] || []);
    const dots = Array.from({ length: 9 }, (_, i) => `<span style="width:5px;height:5px;border-radius:50%;background:${active.has(i) ? 'currentColor' : 'transparent'};"></span>`).join('');
    return `<div class="az-die"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;width:24px;height:24px;">${dots}</div></div>`;
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
      <button data-duel-mode="house" class="az-active az-flex az-gap-1"><span>Gegen Haus</span></button>
      <button data-duel-mode="friend" class="az-flex az-gap-1" ${connected ? '' : 'disabled title="Erst im Arcade-Tab verbinden"'}>${Icon('globe', { size: 14 })}<span>Gegen Freund</span></button>
    </div>`;
  }

  function wireDuelToggle(container, ctx, onModeChange) {
    const btns = container.querySelectorAll('[data-duel-mode]');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        btns.forEach(b => b.classList.toggle('az-active', b === btn));
        onModeChange(btn.getAttribute('data-duel-mode'));
      });
    });
  }

  // ==========================================================
  // SLOT MACHINE
  // ==========================================================
  function renderSlot(container, ctx) {
    const engine = new root.SlotMachineEngine();
    container.innerHTML = `
      <div class="az-flex-col az-gap-3" style="align-items:center;">
        <div class="az-slot-reels">
          <div class="az-slot-reel" id="r0">${Icon(engine.symbols[0], { size: 26 })}</div>
          <div class="az-slot-reel" id="r1">${Icon(engine.symbols[1], { size: 26 })}</div>
          <div class="az-slot-reel" id="r2">${Icon(engine.symbols[2], { size: 26 })}</div>
        </div>
        ${betControl('slot-bet', 10)}
        <button id="slot-spin" class="az-btn az-btn-block">Drehen</button>
        <div class="az-result-banner" id="slot-banner">Viel Glück.</div>
      </div>`;
    const banner = container.querySelector('#slot-banner');
    const spinBtn = container.querySelector('#slot-spin');
    const reels = [container.querySelector('#r0'), container.querySelector('#r1'), container.querySelector('#r2')];

    spinBtn.onclick = () => {
      const bet = readBet(container, 'slot-bet', ctx.wallet);
      if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins.', 'lose'); return; }
      spinBtn.disabled = true;
      reels.forEach(r => r.classList.add('az-spinning'));
      ctx.playSound('spin');
      const result = engine.spin(bet);
      let ticks = 0;
      const iv = setInterval(() => {
        reels.forEach(r => r.innerHTML = Icon(engine.symbols[Math.floor(Math.random() * engine.symbols.length)], { size: 26 }));
        ticks++;
        if (ticks > 8) {
          clearInterval(iv);
          reels.forEach((r, i) => { r.classList.remove('az-spinning'); r.innerHTML = Icon(result.reels[i], { size: 26 }); });
          spinBtn.disabled = false;
          settle(ctx, bet, result.payout);
          if (result.win) {
            ctx.wallet.award(result.payout);
            setBanner(banner, `${result.label} — plus ${fmt(result.payout)}`, 'win');
            ctx.playSound('win');
          } else {
            setBanner(banner, 'Kein Treffer, nochmal versuchen.', 'lose');
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
        engine.hit();
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
        blackjack: 'Blackjack.', win: 'Gewonnen.', dealer_bust: 'Dealer überkauft — gewonnen.',
        lose: 'Verloren.', dealer_blackjack: 'Dealer hat Blackjack.', bust: 'Überkauft.', push: 'Unentschieden.'
      };
      settle(ctx, engine.bet, r.payout);
      if (r.payout > 0) ctx.wallet.award(r.payout);
      const net = r.payout - engine.bet;
      const netLabel = net > 0 ? `+${fmt(net)}` : net < 0 ? `${fmt(net)}` : '±0';
      setBanner(banner, `${labels[r.outcome] || ''} (${netLabel})`, net > 0 ? 'win' : (net === 0 ? '' : 'lose'));
      ctx.playSound(r.payout > engine.bet ? 'win' : 'lose');
      showDealControls();
    }

    function deal() {
      const bet = readBet(container, 'bj-bet', ctx.wallet);
      if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins.', 'lose'); return; }
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
        <button id="rl-spin" class="az-btn az-btn-block">Drehen</button>
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
      if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins.', 'lose'); return; }
      ctx.playSound('spin');
      const result = engine.spin(selected.type, selected.value, bet);
      resultEl.textContent = '···';
      setTimeout(() => {
        resultEl.textContent = result.number;
        resultEl.className = 'az-roulette-number az-num-' + result.color;
        settle(ctx, bet, result.payout);
        if (result.win) {
          ctx.wallet.award(result.payout);
          setBanner(banner, `${result.number} (${result.color}) — gewonnen, plus ${fmt(result.payout)}`, 'win');
          ctx.playSound('win');
        } else {
          setBanner(banner, `${result.number} (${result.color}) — verloren.`, 'lose');
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
        <div class="az-text-footnote">Bube oder besser gewinnt — Karten antippen zum Halten.</div>
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
        if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins.', 'lose'); return; }
        held = [];
        const hand = engine.deal(bet);
        renderHand(hand);
        setBanner(banner, 'Karten halten und ziehen.', '');
        actionBtn.textContent = 'Ziehen';
      } else {
        const r = engine.draw(held);
        renderHand(r.hand);
        settle(ctx, engine.bet, r.payout);
        if (r.win) {
          ctx.wallet.award(r.payout);
          setBanner(banner, `${r.rank.label} — plus ${fmt(r.payout)}`, 'win');
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
      if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins.', 'lose'); return; }
      const r = engine.play(betOn, bet);
      container.querySelector('#bc-banker').innerHTML = r.banker.map(c => cardHtml(c)).join('');
      container.querySelector('#bc-player').innerHTML = r.player.map(c => cardHtml(c)).join('');
      const won = r.payout > bet;
      const push = r.payout === bet;
      settle(ctx, bet, r.payout);
      if (r.payout > 0) ctx.wallet.award(r.payout);
      const winnerLabel = { player: 'Spieler', banker: 'Banker', tie: 'Unentschieden' }[r.winner];
      setBanner(banner, `${winnerLabel} gewinnt (${r.playerTotal} vs ${r.bankerTotal})${won ? ', plus ' + fmt(r.payout) : push ? ', unentschieden' : ', verloren'}`, won ? 'win' : (push ? '' : 'lose'));
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
        <div class="az-flex az-gap-2" id="cr-dice"><div class="az-die"></div><div class="az-die"></div></div>
        ${betControl('cr-bet', 15)}
        <button id="cr-roll" class="az-btn az-btn-block">Werfen</button>
        <div class="az-result-banner" id="cr-banner">Come-out Roll: 7/11 gewinnt sofort, 2/3/12 verliert sofort.</div>
      </div>`;
    const banner = container.querySelector('#cr-banner');
    const diceEl = container.querySelector('#cr-dice');
    const rollBtn = container.querySelector('#cr-roll');
    let duelMode = 'house';
    let duelPending = false;

    wireDuelToggle(container, ctx, (mode) => {
      duelMode = mode;
      rollBtn.textContent = mode === 'friend' ? 'Duell starten' : 'Werfen';
      setBanner(banner, mode === 'friend' ? 'Beide setzen den gleichen Einsatz — höhere Augensumme gewinnt.' : 'Come-out Roll: 7/11 gewinnt sofort, 2/3/12 verliert sofort.', '');
    });

    ctx.duel.setHandler((data) => {
      if (data.type !== 'craps_start' && data.type !== 'craps_response') return;
      if (data.type === 'craps_start') {
        if (duelPending) return;
        if (!ctx.wallet.place(data.stake)) { setBanner(banner, 'Nicht genug Coins für das Duell.', 'lose'); return; }
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
      if (hostSum === guestSum) { ctx.wallet.award(stake); ctx.recordResult('tie', 0); setBanner(banner, `Unentschieden (${hostSum}) — Einsatz zurück.`, ''); return; }
      const iAmHost = ctx.duel.isHost();
      const hostWins = hostSum > guestSum;
      const iWin = (iAmHost && hostWins) || (!iAmHost && !hostWins);
      settle(ctx, stake, iWin ? stake * 2 : 0);
      if (iWin) { ctx.wallet.award(stake * 2); setBanner(banner, `Du gewinnst (${iAmHost ? hostSum : guestSum} gegen ${iAmHost ? guestSum : hostSum}).`, 'win'); ctx.playSound('win'); }
      else { setBanner(banner, `Verloren (${iAmHost ? hostSum : guestSum} gegen ${iAmHost ? guestSum : hostSum}).`, 'lose'); ctx.playSound('lose'); }
    }

    rollBtn.onclick = () => {
      const bet = readBet(container, 'cr-bet', ctx.wallet);
      if (duelMode === 'friend') {
        if (!ctx.duel.isConnected()) { setBanner(banner, 'Nicht verbunden.', 'lose'); return; }
        if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins.', 'lose'); return; }
        const mine = root.CrapsEngine.duelRoll();
        diceEl.innerHTML = mine.dice.map(dieHtml).join('');
        duelPending = { hostSum: mine.sum, stake: bet };
        ctx.duel.send('craps_start', { hostSum: mine.sum, stake: bet });
        setBanner(banner, 'Warte auf deinen Freund…', '');
        return;
      }
      if (engine.point === null) {
        if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins.', 'lose'); return; }
        engine.reset();
        handleRoll(engine.start(bet));
      } else {
        handleRoll(engine.roll());
      }
    };

    function handleRoll(r) {
      diceEl.innerHTML = r.dice.map(dieHtml).join('');
      if (r.done) {
        settle(ctx, engine.bet, r.payout);
        if (r.outcome === 'win') { ctx.wallet.award(r.payout); setBanner(banner, `${r.sum} — gewonnen, plus ${fmt(r.payout)}`, 'win'); ctx.playSound('win'); }
        else { setBanner(banner, `${r.sum} — verloren.`, 'lose'); ctx.playSound('lose'); }
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
        <div class="az-flex az-gap-2" id="sb-dice"><div class="az-die"></div><div class="az-die"></div><div class="az-die"></div></div>
        ${betControl('sb-bet', 15)}
        <div class="az-choice-row">
          <button class="az-choice-btn az-active" data-bet="big">Groß (11–17)</button>
          <button class="az-choice-btn" data-bet="small">Klein (4–10)</button>
          <button class="az-choice-btn" data-bet="any_triple">Jeder Pasch (×30)</button>
        </div>
        <button id="sb-roll" class="az-btn az-btn-block">Würfeln</button>
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
      if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins.', 'lose'); return; }
      const r = engine.roll(betType, null, bet);
      diceEl.innerHTML = r.dice.map(dieHtml).join('');
      settle(ctx, bet, r.payout);
      if (r.win) { ctx.wallet.award(r.payout); setBanner(banner, `Summe ${r.sum} — gewonnen, plus ${fmt(r.payout)}`, 'win'); ctx.playSound('win'); }
      else { setBanner(banner, `Summe ${r.sum}${r.isTriple ? ' (Pasch)' : ''} — verloren.`, 'lose'); ctx.playSound('lose'); }
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
    let pendingHost = null;

    wireDuelToggle(container, ctx, (mode) => {
      duelMode = mode;
      resetActions();
      setBanner(banner, mode === 'friend' ? 'Beide ziehen eine Karte — höchste gewinnt.' : 'Höher oder niedriger als die aktuelle Karte?', '');
    });

    ctx.duel.setHandler((data) => {
      if (data.type === 'hilo_start') {
        if (!ctx.wallet.place(data.stake)) { setBanner(banner, 'Nicht genug Coins für das Duell.', 'lose'); return; }
        const deck = root.CardDeck.createShoe(1);
        const myCard = deck.pop();
        cardEl.innerHTML = cardHtml(myCard);
        ctx.duel.send('hilo_response', { myVal: root.CardDeck.rankValue(myCard.rank), myCard });
        resolveDuel(data.hostVal, root.CardDeck.rankValue(myCard.rank), data.stake, data.hostCard, myCard);
      } else if (data.type === 'hilo_response') {
        resolveDuel(pendingHost.val, data.myVal, pendingHost.stake, pendingHost.card, data.myCard);
      }
    });

    function resolveDuel(hostVal, guestVal, stake, hostCard, guestCard) {
      cardEl.innerHTML = cardHtml(hostCard) + cardHtml(guestCard);
      if (hostVal === guestVal) { ctx.wallet.award(stake); ctx.recordResult('tie', 0); setBanner(banner, 'Unentschieden — Einsatz zurück.', ''); return; }
      const iAmHost = ctx.duel.isHost();
      const hostWins = hostVal > guestVal;
      const iWin = (iAmHost && hostWins) || (!iAmHost && !hostWins);
      settle(ctx, stake, iWin ? stake * 2 : 0);
      if (iWin) { ctx.wallet.award(stake * 2); setBanner(banner, 'Du gewinnst das Duell.', 'win'); ctx.playSound('win'); }
      else { setBanner(banner, 'Verloren.', 'lose'); ctx.playSound('lose'); }
    }

    function resetActions() {
      if (duelMode === 'friend') {
        actions.innerHTML = `<button id="hl-duel-start" class="az-btn az-btn-block">Duell starten</button>`;
        container.querySelector('#hl-duel-start').onclick = () => {
          if (!ctx.duel.isConnected()) { setBanner(banner, 'Nicht verbunden.', 'lose'); return; }
          const bet = readBet(container, 'hl-bet', ctx.wallet);
          if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins.', 'lose'); return; }
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
      if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins.', 'lose'); return; }
      const r = engine.start(bet);
      cardEl.innerHTML = cardHtml(r.card);
      streakEl.textContent = 'Streak: 0';
      setBanner(banner, 'Höher oder niedriger?', '');
      actions.innerHTML = `<button id="hl-lower" class="az-btn az-btn-secondary">Niedriger</button><button id="hl-cash" class="az-btn az-btn-success">Auszahlen</button><button id="hl-higher" class="az-btn">Höher</button>`;
      container.querySelector('#hl-higher').onclick = () => guess('higher');
      container.querySelector('#hl-lower').onclick = () => guess('lower');
      container.querySelector('#hl-cash').onclick = cashOut;
    }

    function guess(dir) {
      const r = engine.guess(dir);
      cardEl.innerHTML = cardHtml(r.card);
      if (r.correct) {
        streakEl.textContent = `Streak: ${r.streak} · möglicher Gewinn ${fmt(r.currentPayout)}`;
        setBanner(banner, 'Richtig — weiter ziehen oder auszahlen.', 'win');
      } else {
        settle(ctx, engine.bet, 0);
        setBanner(banner, 'Falsch geraten — Einsatz verloren.', 'lose');
        ctx.playSound('lose');
        resetActions();
      }
    }

    function cashOut() {
      const r = engine.cashOut();
      if (r) {
        settle(ctx, engine.bet, r.payout);
        ctx.wallet.award(r.payout);
        setBanner(banner, `Ausgezahlt: plus ${fmt(r.payout)} bei Streak ${r.streak}`, 'win');
        ctx.playSound('win');
      }
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
        <div class="az-coin" id="cf-coin">${Icon('coin', { size: 26 })}</div>
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
      flipBtn.textContent = mode === 'friend' ? 'Duell starten (du bist Kopf)' : 'Werfen';
      hint.textContent = mode === 'friend' ? 'Host ist immer Kopf, Freund ist Zahl.' : 'Wähle Kopf oder Zahl.';
    });

    ctx.duel.setHandler((data) => {
      if (data.type !== 'coinflip_start') return;
      if (!ctx.wallet.place(data.stake)) { setBanner(banner, 'Nicht genug Coins für das Duell.', 'lose'); return; }
      animateCoin(() => {
        const iWin = data.result === 'tails'; // guest is always "tails"
        settle(ctx, data.stake, iWin ? data.stake * 2 : 0);
        const side = data.result === 'heads' ? 'Kopf' : 'Zahl';
        if (iWin) { ctx.wallet.award(data.stake * 2); setBanner(banner, `${side} — du gewinnst.`, 'win'); ctx.playSound('win'); }
        else { setBanner(banner, `${side} — verloren.`, 'lose'); ctx.playSound('lose'); }
      });
    });

    function animateCoin(done) {
      coinEl.classList.add('az-flipping');
      setTimeout(() => { coinEl.classList.remove('az-flipping'); done(); }, 600);
    }

    flipBtn.onclick = () => {
      const bet = readBet(container, 'cf-bet', ctx.wallet);
      if (duelMode === 'friend') {
        if (!ctx.duel.isConnected()) { setBanner(banner, 'Nicht verbunden.', 'lose'); return; }
        if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins.', 'lose'); return; }
        const result = root.CoinFlipEngine.duelFlip();
        ctx.duel.send('coinflip_start', { stake: bet, result });
        animateCoin(() => {
          const iWin = result === 'heads'; // host is always "heads"
          settle(ctx, bet, iWin ? bet * 2 : 0);
          const side = result === 'heads' ? 'Kopf' : 'Zahl';
          if (iWin) { ctx.wallet.award(bet * 2); setBanner(banner, `${side} — du gewinnst.`, 'win'); ctx.playSound('win'); }
          else { setBanner(banner, `${side} — verloren.`, 'lose'); ctx.playSound('lose'); }
        });
        return;
      }
      if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins.', 'lose'); return; }
      const r = engine.flip(call, bet);
      animateCoin(() => {
        settle(ctx, bet, r.payout);
        const side = r.result === 'heads' ? 'Kopf' : 'Zahl';
        if (r.win) { ctx.wallet.award(r.payout); setBanner(banner, `${side} — gewonnen, plus ${fmt(r.payout)}`, 'win'); ctx.playSound('win'); }
        else { setBanner(banner, `${side} — verloren.`, 'lose'); ctx.playSound('lose'); }
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
        <button id="pl-drop" class="az-btn az-btn-block">Ball fallen lassen</button>
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
      if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins.', 'lose'); return; }
      const r = engine.drop(bet, risk);
      ctx.playSound('spin');
      setTimeout(() => {
        renderBuckets(r.bucket);
        settle(ctx, bet, r.payout);
        if (r.payout > bet) { ctx.wallet.award(r.payout); setBanner(banner, `${r.multiplier}× Feld — gewonnen, plus ${fmt(r.payout)}`, 'win'); ctx.playSound('win'); }
        else if (r.payout === bet) { ctx.wallet.award(r.payout); setBanner(banner, `${r.multiplier}× Feld — Einsatz zurück.`, ''); }
        else { setBanner(banner, `${r.multiplier}× Feld — verloren.`, 'lose'); ctx.playSound('lose'); }
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
        <button id="wh-spin" class="az-btn az-btn-block">Glücksrad drehen</button>
        <div class="az-result-banner" id="wh-banner">Triff dein Glück.</div>
      </div>`;
    const track = container.querySelector('#wh-track');
    const banner = container.querySelector('#wh-banner');
    function renderTrack(landed = -1) {
      track.innerHTML = engine.segments.map((m, i) => `<div class="az-wheel-seg ${i === landed ? 'az-landed' : ''}">${m}×</div>`).join('');
    }
    renderTrack();
    container.querySelector('#wh-spin').onclick = () => {
      const bet = readBet(container, 'wh-bet', ctx.wallet);
      if (!ctx.wallet.place(bet)) { setBanner(banner, 'Nicht genug Coins.', 'lose'); return; }
      ctx.playSound('spin');
      let ticks = 0;
      const iv = setInterval(() => {
        renderTrack(Math.floor(Math.random() * engine.segments.length));
        ticks++;
        if (ticks > 12) {
          clearInterval(iv);
          const r = engine.spin(bet);
          renderTrack(r.index);
          settle(ctx, bet, r.payout);
          if (r.payout > bet) { ctx.wallet.award(r.payout); setBanner(banner, `${r.multiplier}× — gewonnen, plus ${fmt(r.payout)}`, 'win'); ctx.playSound('win'); }
          else if (r.payout === bet) { ctx.wallet.award(r.payout); setBanner(banner, `${r.multiplier}× — Einsatz zurück.`, ''); }
          else { setBanner(banner, `${r.multiplier}× — verloren.`, 'lose'); ctx.playSound('lose'); }
        }
      }, 90);
    };
  }

  root.CASINO_GAMES = [
    { id: 'slot', icon: 'slot', title: 'Spielautomat', render: renderSlot },
    { id: 'blackjack', icon: 'cards', title: 'Blackjack', render: renderBlackjack },
    { id: 'roulette', icon: 'target', title: 'Roulette', render: renderRoulette },
    { id: 'videopoker', icon: 'cards', title: 'Video Poker', render: renderVideoPoker },
    { id: 'baccarat', icon: 'cards', title: 'Baccarat', render: renderBaccarat },
    { id: 'craps', icon: 'dice', title: 'Craps', duel: true, render: renderCraps },
    { id: 'sicbo', icon: 'dice', title: 'Sic Bo', render: renderSicBo },
    { id: 'higherlower', icon: 'cards', title: 'Höher/Tiefer', duel: true, render: renderHigherLower },
    { id: 'coinflip', icon: 'coin', title: 'Münzwurf', duel: true, render: renderCoinFlip },
    { id: 'plinko', icon: 'drop', title: 'Plinko', render: renderPlinko },
    { id: 'wheel', icon: 'wheel', title: 'Glücksrad', render: renderWheel }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
