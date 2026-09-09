/**
 * Shared card-deck utilities used by Blackjack, Video Poker, Baccarat and Higher/Lower.
 */
(function (root) {
  'use strict';

  const SUITS = ['♠', '♥', '♦', '♣'];
  const RED_SUITS = ['♥', '♦'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  function createShoe(deckCount = 1) {
    const cards = [];
    for (let d = 0; d < deckCount; d++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          cards.push({ suit, rank, red: RED_SUITS.includes(suit) });
        }
      }
    }
    return shuffle(cards);
  }

  function shuffle(cards) {
    const arr = cards.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function cardLabel(card) {
    return `${card.rank}${card.suit}`;
  }

  function rankValue(rank) {
    if (rank === 'A') return 14;
    if (rank === 'K') return 13;
    if (rank === 'Q') return 12;
    if (rank === 'J') return 11;
    return parseInt(rank, 10);
  }

  function blackjackValue(hand) {
    let total = 0;
    let aces = 0;
    for (const c of hand) {
      if (c.rank === 'A') { total += 11; aces++; }
      else if (['J', 'Q', 'K'].includes(c.rank)) total += 10;
      else total += parseInt(c.rank, 10);
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }

  root.CardDeck = { createShoe, shuffle, cardLabel, rankValue, blackjackValue, SUITS, RANKS };
})(typeof window !== 'undefined' ? window : globalThis);
