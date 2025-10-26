"use strict";

const playerForm = document.querySelector("#playerForm");
const playerNameInput = document.querySelector("#playerName");
const addPlayerButton = playerForm.querySelector('button[type="submit"]');
const playerList = document.querySelector("#playerList");
const statusMessage = document.querySelector("#statusMessage");
const startButton = document.querySelector("#startButton");
const resetButton = document.querySelector("#resetButton");
const countdownDisplay = document.querySelector("#countdownDisplay");
const reactionArea = document.querySelector("#reactionArea");
const loserDisplay = document.querySelector("#loserDisplay");

let players = [];
let countdownTimer = null;
let countdownValue = 3;
let gameActive = false;
let reactionStart = null;
let playerIdCounter = 1;

function renderPlayers() {
  playerList.innerHTML = players
    .map((player) => {
      const hasTime = typeof player.reactionTime === "number";
      const status = hasTime
        ? `${(player.reactionTime / 1000).toFixed(2)}s`
        : gameActive
        ? "Waiting"
        : "Ready";
      return `
        <li class="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
          <span class="font-medium">${player.name}</span>
          <span class="text-sm text-slate-500">${status}</span>
        </li>
      `;
    })
    .join("");
}

function clearStatus() {
  statusMessage.textContent = "";
}

function showStatus(message) {
  statusMessage.textContent = message;
}

function addPlayer(name) {
  const trimmed = name.trim();
  if (!trimmed) {
    showStatus("Please enter a name before adding.");
    return;
  }

  if (gameActive) {
    showStatus("Wait for the round to finish before adding players.");
    return;
  }

  players.push({ id: playerIdCounter, name: trimmed, reactionTime: null });
  playerIdCounter += 1;
  renderPlayers();
  clearStatus();
}

function resetPlayersReaction() {
  players = players.map((player) => ({ ...player, reactionTime: null }));
}

function setControlsDisabled(disabled) {
  playerNameInput.disabled = disabled;
  addPlayerButton.disabled = disabled;
  startButton.disabled = disabled;
}

function beginReactionPhase() {
  gameActive = true;
  reactionStart = Date.now();
  reactionArea.innerHTML = players
    .map(
      (player) => `
        <button
          class="rounded-2xl bg-amber-400 px-4 py-3 text-lg font-semibold text-slate-900 shadow hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-slate-200"
          data-player-id="${player.id}"
        >
          ${player.name}
        </button>
      `
    )
    .join("");

  reactionArea
    .querySelectorAll("button[data-player-id]")
    .forEach((button) => {
      button.addEventListener("click", () => handleReaction(button));
    });

  renderPlayers();
  showStatus("Tap your button as fast as you can!");
}

function handleReaction(button) {
  if (!gameActive || reactionStart === null) {
    return;
  }

  const playerId = Number(button.dataset.playerId);
  const player = players.find((entry) => entry.id === playerId);
  if (!player || typeof player.reactionTime === "number") {
    return;
  }

  player.reactionTime = Date.now() - reactionStart;
  button.disabled = true;
  button.textContent = `${player.name} \u2713`;
  renderPlayers();
  checkForLoser();
}

function checkForLoser() {
  const allAnswered = players.every(
    (player) => typeof player.reactionTime === "number"
  );

  if (!allAnswered) {
    return;
  }

  gameActive = false;
  setControlsDisabled(false);
  showStatus("Round complete. Reset or play again!");

  const slowestTime = Math.max(
    ...players.map((player) => player.reactionTime ?? 0)
  );
  const slowestPlayers = players.filter(
    (player) => player.reactionTime === slowestTime
  );

  if (slowestPlayers.length === 1) {
    loserDisplay.textContent = `${slowestPlayers[0].name} lost with ${(slowestTime /
      1000).toFixed(2)}s.`;
  } else {
    const names = slowestPlayers.map((player) => player.name).join(", ");
    loserDisplay.textContent = `${names} tied for last at ${(slowestTime /
      1000).toFixed(2)}s.`;
  }
}

function startCountdown() {
  if (players.length < 2) {
    showStatus("Add at least two players to start.");
    return;
  }

  if (gameActive) {
    showStatus("A round is already running.");
    return;
  }

  clearStatus();
  resetPlayersReaction();
  renderPlayers();
  reactionArea.innerHTML = "";
  loserDisplay.textContent = "Waiting for a round";

  countdownValue = 3;
  countdownDisplay.textContent = countdownValue;
  setControlsDisabled(true);

  countdownTimer = setInterval(() => {
    countdownValue -= 1;
    if (countdownValue > 0) {
      countdownDisplay.textContent = countdownValue;
      return;
    }

    clearInterval(countdownTimer);
    countdownTimer = null;
    countdownDisplay.textContent = "Go!";
    beginReactionPhase();
  }, 1000);
}

function resetGame() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }

  gameActive = false;
  reactionStart = null;
  resetPlayersReaction();
  renderPlayers();
  reactionArea.innerHTML = "";
  loserDisplay.textContent = "Waiting for a round";
  countdownDisplay.textContent = "Ready";
  setControlsDisabled(false);
  clearStatus();
}

playerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addPlayer(playerNameInput.value);
  playerNameInput.value = "";
  playerNameInput.focus();
});

startButton.addEventListener("click", startCountdown);
resetButton.addEventListener("click", resetGame);

renderPlayers();
