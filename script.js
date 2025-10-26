"use strict";

const fruits = [
  { id: "strawberry", label: "Strawberries", emoji: "🍓", color: "text-rose-500" },
  { id: "banana", label: "Bananas", emoji: "🍌", color: "text-yellow-500" },
  { id: "lime", label: "Limes", emoji: "🍋", color: "text-lime-500" },
  { id: "plum", label: "Plums", emoji: "🍇", color: "text-purple-500" },
];

const fruitMap = Object.fromEntries(fruits.map((fruit) => [fruit.id, fruit]));
const cardValues = [1, 1, 1, 2, 2, 3, 3, 4, 4, 5];

const playersContainer = document.querySelector("#playersContainer");
const fruitTotalsContainer = document.querySelector("#fruitTotals");
const scoreValue = document.querySelector("#scoreValue");
const turnValue = document.querySelector("#turnValue");
const deckValue = document.querySelector("#deckValue");
const bellStatus = document.querySelector("#bellStatus");
const statusMessage = document.querySelector("#statusMessage");
const ringButton = document.querySelector("#ringButton");
const nextTurnButton = document.querySelector("#nextTurnButton");
const resetButton = document.querySelector("#resetButton");

let players = [];
let score = 0;
let turn = 0;
let currentTotals = {};
let matchingFruits = [];

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function createDeck() {
  const deck = [];
  fruits.forEach((fruit) => {
    cardValues.forEach((value) => {
      deck.push({ fruitId: fruit.id, value });
    });
  });
  shuffle(deck);
  return deck;
}

function dealDeck(deck) {
  players = Array.from({ length: 4 }, (_, index) => ({
    id: index + 1,
    name: index === 0 ? "You" : `Player ${index}`,
    deck: [],
    pile: [],
  }));

  deck.forEach((card, index) => {
    const targetPlayer = players[index % players.length];
    targetPlayer.deck.push(card);
  });
}

function computeTotals() {
  const totals = {};
  players.forEach((player) => {
    player.pile.forEach((card) => {
      totals[card.fruitId] = (totals[card.fruitId] || 0) + card.value;
    });
  });
  return totals;
}

function renderPlayers() {
  playersContainer.innerHTML = players
    .map((player) => {
      const topCard = player.pile[player.pile.length - 1];
      const topCardMarkup = topCard
        ? renderCard(topCard)
        : '<div class="h-24 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300">Waiting…</div>';

      const pileMarkup = player.pile
        .slice(-4)
        .reverse()
        .map(
          (card) => `
              <div class="px-3 py-1 rounded-full bg-slate-100 text-sm font-medium text-slate-600 flex items-center gap-1">
                <span>${fruitMap[card.fruitId].emoji}</span>
                <span>${card.value}</span>
              </div>
            `
        )
        .join("");

      return `
        <article class="border border-slate-200 rounded-3xl p-4 bg-white shadow-sm space-y-4">
          <header class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">${player.name}</h3>
            <span class="text-sm text-slate-500">Deck: ${player.deck.length}</span>
          </header>
          ${topCardMarkup}
          <div class="flex flex-wrap gap-2 min-h-[2.5rem]">${pileMarkup ||
            '<span class="text-sm text-slate-400">No cards yet</span>'}</div>
        </article>
      `;
    })
    .join("");
}

function renderCard(card) {
  const fruit = fruitMap[card.fruitId];
  return `
    <div class="h-24 rounded-2xl border-4 border-slate-900 bg-white shadow-inner flex flex-col items-center justify-center gap-1">
      <span class="text-4xl">${fruit.emoji}</span>
      <span class="text-lg font-semibold ${fruit.color}">x${card.value}</span>
    </div>
  `;
}

function renderFruitTotals() {
  fruitTotalsContainer.innerHTML = fruits
    .map((fruit) => {
      const total = currentTotals[fruit.id] || 0;
      const isMatch = total === 5;
      return `
        <div class="border rounded-3xl p-4 bg-slate-50 flex flex-col gap-2 ${
          isMatch ? "border-amber-400 bg-amber-50 shadow" : "border-slate-200"
        }">
          <div class="flex items-center gap-2">
            <span class="text-3xl">${fruit.emoji}</span>
            <span class="text-lg font-semibold">${fruit.label}</span>
          </div>
          <p class="text-sm text-slate-500">Total: <span class="text-base font-semibold ${
            isMatch ? "text-amber-500" : "text-slate-700"
          }">${total}</span></p>
        </div>
      `;
    })
    .join("");
}

function updateBellState() {
  if (matchingFruits.length > 0) {
    bellStatus.textContent = `Ding! ${matchingFruits
      .map((fruit) => fruit.label)
      .join(" and ")} at five.`;
    ringButton.classList.add("animate-bounce", "bg-amber-500", "text-slate-900");
    ringButton.classList.remove("bg-amber-400");
  } else {
    bellStatus.textContent = "Keep watching the fruit!";
    ringButton.classList.remove("animate-bounce", "bg-amber-500");
    ringButton.classList.add("bg-amber-400");
  }
}

function updateScoreboard() {
  scoreValue.textContent = score;
  turnValue.textContent = turn;
  deckValue.textContent = players[0]?.deck.length ?? 0;
}

function render() {
  currentTotals = computeTotals();
  matchingFruits = fruits.filter((fruit) => currentTotals[fruit.id] === 5);
  renderPlayers();
  renderFruitTotals();
  updateBellState();
  updateScoreboard();
}

function drawCards() {
  const playable = players.some((player) => player.deck.length > 0);
  if (!playable) {
    statusMessage.textContent =
      "Everyone is out of face-down cards. Collect the piles or reset to start again.";
    return;
  }

  players.forEach((player) => {
    if (player.deck.length === 0) {
      return;
    }
    const card = player.deck.shift();
    player.pile.push(card);
  });

  turn += 1;
  statusMessage.textContent =
    "Watch the fruit totals. Tap the bell if you spot exactly five!";
  render();
}

function collectPiles(winner) {
  const collected = [];
  players.forEach((player) => {
    collected.push(...player.pile);
    player.pile = [];
  });
  shuffle(collected);
  winner.deck.push(...collected);
}

function handleRing() {
  if (matchingFruits.length > 0) {
    collectPiles(players[0]);
    score += 1;
    statusMessage.textContent = `Nice catch! ${matchingFruits
      .map((fruit) => fruit.label)
      .join(" and ")} totaled five.`;
  } else {
    statusMessage.textContent = "Too soon! You lose the top card from your deck.";
    if (players[0].deck.length > 0) {
      const penaltyCard = players[0].deck.shift();
      const opponents = players.slice(1).filter((player) => player.deck.length > 0);
      const target = opponents.length
        ? opponents[Math.floor(Math.random() * opponents.length)]
        : players[Math.floor(Math.random() * (players.length - 1)) + 1];
      target.deck.push(penaltyCard);
    }
    score = Math.max(0, score - 1);
  }
  render();
}

function resetGame() {
  const deck = createDeck();
  score = 0;
  turn = 0;
  dealDeck(deck);
  matchingFruits = [];
  currentTotals = {};
  statusMessage.textContent =
    "Flip cards until exactly five of a fruit appear. Ring the bell to collect the piles.";
  render();
}

nextTurnButton.addEventListener("click", drawCards);
ringButton.addEventListener("click", handleRing);
resetButton.addEventListener("click", resetGame);

resetGame();
