/**
 * Casino game engines. Every engine is pure logic (no DOM), returns plain
 * result objects that the UI layer renders and animates. All randomness is
 * local (Math.random) — there is no server or database involved.
 */
(function (root) {
  'use strict';

  const Cards = root.CardDeck;

  function randInt(maxExclusive) { return Math.floor(Math.random() * maxExclusive); }
  function pick(arr) { return arr[randInt(arr.length)]; }

  // ==========================================================
  // 1. SLOT MACHINE
  // ==========================================================
  class SlotMachineEngine {
    constructor() {
      this.symbols = ['💼', '🍒', '💰', '💎', '7️⃣', '🚀'];
    }
    spin(bet) {
      const reels = [pick(this.symbols), pick(this.symbols), pick(this.symbols)];
      let payout = 0;
      let label = '';
      if (reels[0] === reels[1] && reels[1] === reels[2]) {
        const jackpotSymbols = ['💎', '7️⃣'];
        payout = jackpotSymbols.includes(reels[0]) ? bet * 50 : bet * 20;
        label = jackpotSymbols.includes(reels[0]) ? 'JACKPOT' : 'BIG WIN';
      } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
        payout = bet * 3;
        label = 'MINI WIN';
      }
      return { reels, payout, win: payout > 0, label };
    }
  }

  // ==========================================================
  // 2. BLACKJACK
  // ==========================================================
  class BlackjackEngine {
    constructor() { this.reset(); }
    reset() {
      this.deck = [];
      this.playerHand = [];
      this.dealerHand = [];
      this.phase = 'idle'; // idle -> playing -> dealer -> done
      this.result = null;
      this.bet = 0;
    }
    deal(bet) {
      this.deck = Cards.createShoe(2);
      this.playerHand = [this.deck.pop(), this.deck.pop()];
      this.dealerHand = [this.deck.pop(), this.deck.pop()];
      this.bet = bet;
      this.result = null;
      this.phase = 'playing';
      if (Cards.blackjackValue(this.playerHand) === 21) {
        this.phase = 'dealer';
        return this.resolveDealer();
      }
      return { phase: this.phase };
    }
    hit() {
      if (this.phase !== 'playing') return null;
      this.playerHand.push(this.deck.pop());
      const value = Cards.blackjackValue(this.playerHand);
      if (value > 21) {
        this.phase = 'done';
        this.result = { outcome: 'bust', payout: 0 };
        return this.result;
      }
      return { phase: this.phase, value };
    }
    stand() {
      if (this.phase !== 'playing') return null;
      this.phase = 'dealer';
      return this.resolveDealer();
    }
    resolveDealer() {
      while (Cards.blackjackValue(this.dealerHand) < 17) {
        this.dealerHand.push(this.deck.pop());
      }
      const playerValue = Cards.blackjackValue(this.playerHand);
      const dealerValue = Cards.blackjackValue(this.dealerHand);
      const playerBJ = playerValue === 21 && this.playerHand.length === 2;
      const dealerBJ = dealerValue === 21 && this.dealerHand.length === 2;
      let outcome, payout;
      if (dealerValue > 21) { outcome = 'dealer_bust'; payout = this.bet * 2; }
      else if (playerBJ && !dealerBJ) { outcome = 'blackjack'; payout = Math.floor(this.bet * 2.5); }
      else if (dealerBJ && !playerBJ) { outcome = 'dealer_blackjack'; payout = 0; }
      else if (playerValue > dealerValue) { outcome = 'win'; payout = this.bet * 2; }
      else if (playerValue < dealerValue) { outcome = 'lose'; payout = 0; }
      else { outcome = 'push'; payout = this.bet; }
      this.phase = 'done';
      this.result = { outcome, payout, playerValue, dealerValue };
      return this.result;
    }
  }

  // ==========================================================
  // 3. ROULETTE (European, single zero)
  // ==========================================================
  class RouletteEngine {
    constructor() {
      this.redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
    }
    colorOf(n) { if (n === 0) return 'green'; return this.redNumbers.has(n) ? 'red' : 'black'; }
    spin(betType, betValue, amount) {
      const number = randInt(37);
      const color = this.colorOf(number);
      let win = false;
      let multiplier = 0;
      switch (betType) {
        case 'straight': win = number === betValue; multiplier = 36; break;
        case 'color': win = color === betValue; multiplier = 2; break;
        case 'parity': win = number !== 0 && (number % 2 === 0 ? 'even' : 'odd') === betValue; multiplier = 2; break;
        case 'half': win = number !== 0 && (betValue === 'low' ? number <= 18 : number >= 19); multiplier = 2; break;
        case 'dozen': {
          const d = betValue; // 1, 2, 3
          win = number !== 0 && Math.ceil(number / 12) === d;
          multiplier = 3;
          break;
        }
      }
      const payout = win ? amount * multiplier : 0;
      return { number, color, win, payout };
    }
  }

  // ==========================================================
  // 4. VIDEO POKER (Jacks or Better)
  // ==========================================================
  class VideoPokerEngine {
    constructor() { this.reset(); }
    reset() {
      this.deck = [];
      this.hand = [];
      this.phase = 'idle'; // idle -> held -> done
      this.bet = 0;
    }
    deal(bet) {
      this.deck = Cards.createShoe(1);
      this.hand = [this.deck.pop(), this.deck.pop(), this.deck.pop(), this.deck.pop(), this.deck.pop()];
      this.bet = bet;
      this.phase = 'held';
      return this.hand;
    }
    draw(holdIndices) {
      for (let i = 0; i < 5; i++) {
        if (!holdIndices.includes(i)) this.hand[i] = this.deck.pop();
      }
      this.phase = 'done';
      const rank = this.evaluate(this.hand);
      const table = {
        'royal_flush': 250, 'straight_flush': 50, 'four_kind': 25, 'full_house': 9,
        'flush': 6, 'straight': 4, 'three_kind': 3, 'two_pair': 2, 'jacks_or_better': 1, 'nothing': 0
      };
      const multiplier = table[rank.name] || 0;
      const payout = this.bet * multiplier;
      return { hand: this.hand, rank, payout, win: payout > 0 };
    }
    evaluate(hand) {
      const values = hand.map(c => Cards.rankValue(c.rank)).sort((a, b) => a - b);
      const suits = hand.map(c => c.suit);
      const isFlush = suits.every(s => s === suits[0]);
      const uniqueVals = [...new Set(values)];
      const isStraight = uniqueVals.length === 5 && (values[4] - values[0] === 4 ||
        (values.join(',') === '2,3,4,5,14')); // wheel straight (A-2-3-4-5)
      const counts = {};
      values.forEach(v => counts[v] = (counts[v] || 0) + 1);
      const countValues = Object.values(counts).sort((a, b) => b - a);

      if (isFlush && isStraight && values[0] === 10) return { name: 'royal_flush', label: 'Royal Flush' };
      if (isFlush && isStraight) return { name: 'straight_flush', label: 'Straight Flush' };
      if (countValues[0] === 4) return { name: 'four_kind', label: 'Vierling' };
      if (countValues[0] === 3 && countValues[1] === 2) return { name: 'full_house', label: 'Full House' };
      if (isFlush) return { name: 'flush', label: 'Flush' };
      if (isStraight) return { name: 'straight', label: 'Straße' };
      if (countValues[0] === 3) return { name: 'three_kind', label: 'Drilling' };
      if (countValues[0] === 2 && countValues[1] === 2) return { name: 'two_pair', label: 'Zwei Paare' };
      if (countValues[0] === 2) {
        const pairValue = Object.keys(counts).find(k => counts[k] === 2);
        if (parseInt(pairValue, 10) >= 11) return { name: 'jacks_or_better', label: 'Bube oder besser' };
      }
      return { name: 'nothing', label: 'Nichts' };
    }
  }

  // ==========================================================
  // 5. BACCARAT
  // ==========================================================
  class BaccaratEngine {
    baccaratValue(hand) {
      let total = 0;
      for (const c of hand) {
        if (['J', 'Q', 'K', '10'].includes(c.rank)) total += 0;
        else if (c.rank === 'A') total += 1;
        else total += parseInt(c.rank, 10);
      }
      return total % 10;
    }
    play(betOn, amount) {
      const deck = Cards.createShoe(1);
      const player = [deck.pop(), deck.pop()];
      const banker = [deck.pop(), deck.pop()];
      let playerTotal = this.baccaratValue(player);
      let bankerTotal = this.baccaratValue(banker);

      const naturalWin = playerTotal >= 8 || bankerTotal >= 8;
      if (!naturalWin) {
        let playerThird = null;
        if (playerTotal <= 5) {
          playerThird = deck.pop();
          player.push(playerThird);
          playerTotal = this.baccaratValue(player);
        }
        const bankerDraws = () => {
          if (playerThird === null) return bankerTotal <= 5;
          const v = Cards.rankValue(playerThird.rank) === 14 ? 1 : (Cards.rankValue(playerThird.rank) >= 10 ? 0 : Cards.rankValue(playerThird.rank));
          if (bankerTotal <= 2) return true;
          if (bankerTotal === 3) return v !== 8;
          if (bankerTotal === 4) return v >= 2 && v <= 7;
          if (bankerTotal === 5) return v >= 4 && v <= 7;
          if (bankerTotal === 6) return v === 6 || v === 7;
          return false;
        };
        if (bankerDraws()) {
          banker.push(deck.pop());
          bankerTotal = this.baccaratValue(banker);
        }
      }

      let winner;
      if (playerTotal > bankerTotal) winner = 'player';
      else if (bankerTotal > playerTotal) winner = 'banker';
      else winner = 'tie';

      let payout = 0;
      if (betOn === winner) {
        if (winner === 'banker') payout = Math.floor(amount * 1.95);
        else if (winner === 'player') payout = amount * 2;
        else payout = amount * 9;
      } else if (winner === 'tie' && betOn !== 'tie') {
        payout = amount; // push on tie for player/banker bets
      }

      return { player, banker, playerTotal, bankerTotal, winner, payout, win: payout > amount || (winner === 'tie' && betOn !== 'tie') || (betOn === winner) };
    }
  }

  // ==========================================================
  // 6. CRAPS (simplified Pass Line)
  // ==========================================================
  class CrapsEngine {
    constructor() { this.reset(); }
    reset() { this.point = null; this.phase = 'come_out'; this.bet = 0; }
    rollDice() { return [1 + randInt(6), 1 + randInt(6)]; }
    start(bet) {
      this.bet = bet;
      this.phase = 'come_out';
      return this.roll();
    }
    roll() {
      const dice = this.rollDice();
      const sum = dice[0] + dice[1];
      if (this.phase === 'come_out') {
        if (sum === 7 || sum === 11) return { dice, sum, done: true, outcome: 'win', payout: this.bet * 2 };
        if (sum === 2 || sum === 3 || sum === 12) return { dice, sum, done: true, outcome: 'lose', payout: 0 };
        this.point = sum;
        this.phase = 'point';
        return { dice, sum, done: false, point: this.point };
      }
      if (sum === this.point) return { dice, sum, done: true, outcome: 'win', payout: this.bet * 2 };
      if (sum === 7) return { dice, sum, done: true, outcome: 'lose', payout: 0 };
      return { dice, sum, done: false, point: this.point };
    }
    // 1v1 duel: both peers roll two dice, higher sum wins the pot.
    static duelRoll() {
      const dice = [1 + randInt(6), 1 + randInt(6)];
      return { dice, sum: dice[0] + dice[1] };
    }
  }

  // ==========================================================
  // 7. SIC BO
  // ==========================================================
  class SicBoEngine {
    roll(betType, betValue, amount) {
      const dice = [1 + randInt(6), 1 + randInt(6), 1 + randInt(6)];
      const sum = dice[0] + dice[1] + dice[2];
      const isTriple = dice[0] === dice[1] && dice[1] === dice[2];
      let win = false;
      let multiplier = 0;

      switch (betType) {
        case 'big': win = !isTriple && sum >= 11 && sum <= 17; multiplier = 2; break;
        case 'small': win = !isTriple && sum >= 4 && sum <= 10; multiplier = 2; break;
        case 'specific_triple': win = isTriple && dice[0] === betValue; multiplier = 180; break;
        case 'any_triple': win = isTriple; multiplier = 30; break;
        case 'total': win = sum === betValue; multiplier = { 4: 60, 17: 60, 5: 30, 16: 30, 6: 17, 15: 17, 7: 12, 14: 12, 8: 8, 13: 8, 9: 6, 12: 6, 10: 6, 11: 6 }[betValue] || 6; break;
      }

      const payout = win ? amount * multiplier : 0;
      return { dice, sum, isTriple, win, payout };
    }
  }

  // ==========================================================
  // 8. HIGHER OR LOWER
  // ==========================================================
  class HigherLowerEngine {
    constructor() { this.reset(); }
    reset() { this.deck = []; this.current = null; this.streak = 0; this.bet = 0; this.phase = 'idle'; }
    start(bet) {
      this.deck = Cards.createShoe(1);
      this.current = this.deck.pop();
      this.streak = 0;
      this.bet = bet;
      this.phase = 'playing';
      return { card: this.current };
    }
    guess(direction) {
      if (this.phase !== 'playing') return null;
      const next = this.deck.pop();
      const curVal = Cards.rankValue(this.current.rank);
      const nextVal = Cards.rankValue(next.rank);
      let correct;
      if (nextVal === curVal) correct = false; // tie counts as loss to keep odds honest
      else correct = direction === 'higher' ? nextVal > curVal : nextVal < curVal;

      this.current = next;
      if (correct) {
        this.streak++;
        const multiplier = 1 + this.streak * 0.5;
        return { card: next, correct: true, streak: this.streak, currentPayout: Math.floor(this.bet * multiplier) };
      }
      this.phase = 'done';
      return { card: next, correct: false, streak: this.streak, payout: 0 };
    }
    cashOut() {
      if (this.phase !== 'playing') return null;
      const multiplier = 1 + this.streak * 0.5;
      const payout = Math.floor(this.bet * multiplier);
      this.phase = 'done';
      return { payout, streak: this.streak };
    }
  }

  // ==========================================================
  // 9. COIN FLIP
  // ==========================================================
  class CoinFlipEngine {
    flip(call, amount) {
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const win = result === call;
      return { result, win, payout: win ? amount * 2 : 0 };
    }
    // 1v1 duel: host flips, both calls compared; correct caller (or first if both) wins pot.
    static duelFlip() {
      return Math.random() < 0.5 ? 'heads' : 'tails';
    }
  }

  // ==========================================================
  // 10. PLINKO
  // ==========================================================
  class PlinkoEngine {
    constructor(rows = 12) {
      this.rows = rows;
      this.multipliers = {
        low: [1.5, 1.2, 1.1, 1.0, 0.5, 0.3, 0.5, 1.0, 1.1, 1.2, 1.5],
        medium: [3, 2, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 2, 3],
        high: [10, 5, 2, 0.5, 0.3, 0.2, 0.3, 0.5, 2, 5, 10]
      };
    }
    drop(bet, risk = 'medium') {
      const table = this.multipliers[risk] || this.multipliers.medium;
      const slots = table.length;
      const path = [];
      let position = 0;
      for (let i = 0; i < this.rows; i++) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        position += dir;
        path.push(dir);
      }
      const center = Math.floor(this.rows / 2);
      let bucket = Math.round((position + this.rows) / 2 * ((slots - 1) / this.rows));
      bucket = Math.max(0, Math.min(slots - 1, bucket));
      const multiplier = table[bucket];
      const payout = Math.floor(bet * multiplier);
      return { path, bucket, multiplier, payout, win: multiplier >= 1 };
    }
  }

  // ==========================================================
  // 11. WHEEL OF FORTUNE
  // ==========================================================
  class WheelEngine {
    constructor() {
      // 20 segments, weighted toward small multipliers like a real money wheel.
      this.segments = [
        1, 2, 1, 5, 1, 2, 1, 3, 1, 2,
        1, 10, 1, 2, 1, 3, 1, 2, 1, 20
      ];
    }
    spin(bet) {
      const index = randInt(this.segments.length);
      const multiplier = this.segments[index];
      const payout = bet * multiplier;
      return { index, multiplier, payout, win: multiplier > 1, segments: this.segments };
    }
  }

  root.SlotMachineEngine = SlotMachineEngine;
  root.BlackjackEngine = BlackjackEngine;
  root.RouletteEngine = RouletteEngine;
  root.VideoPokerEngine = VideoPokerEngine;
  root.BaccaratEngine = BaccaratEngine;
  root.CrapsEngine = CrapsEngine;
  root.SicBoEngine = SicBoEngine;
  root.HigherLowerEngine = HigherLowerEngine;
  root.CoinFlipEngine = CoinFlipEngine;
  root.PlinkoEngine = PlinkoEngine;
  root.WheelEngine = WheelEngine;
})(typeof window !== 'undefined' ? window : globalThis);
