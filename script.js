"use strict";

const playerForm = document.querySelector("#playerForm");
const playerNameInput = document.querySelector("#playerName");
const addPlayerButton = playerForm.querySelector('button[type="submit"]');
const playerList = document.querySelector("#playerList");
const statusMessageEl = document.querySelector("#statusMessage");
const startButton = document.querySelector("#startButton");
const resetButton = document.querySelector("#resetButton");
const countdownDisplay = document.querySelector("#countdownDisplay");
const reactionArea = document.querySelector("#reactionArea");
const loserDisplay = document.querySelector("#loserDisplay");

let socket = null;
let socketConnected = false;
let connectionStatus = "Connecting to server...";
let reconnectTimer = null;
const RECONNECT_DELAY = 2000;

const appState = {
  players: [],
  countdownDisplay: "Ready",
  statusMessage: "",
  loserText: "Waiting for a round",
  gameActive: false,
  countdownRunning: false,
};

function applyState(newState) {
  appState.players = newState.players || [];
  appState.countdownDisplay = newState.countdownDisplay || "Ready";
  appState.statusMessage = newState.statusMessage || "";
  appState.loserText = newState.loserText || "Waiting for a round";
  appState.gameActive = Boolean(newState.gameActive);
  appState.countdownRunning = Boolean(newState.countdownRunning);
  render();
}

function renderPlayers() {
  const content = appState.players
    .map((player) => {
      const hasTime = typeof player.reactionTime === "number";
      const status = hasTime
        ? `${(player.reactionTime / 1000).toFixed(2)}s`
        : appState.gameActive
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

  playerList.innerHTML = content;
}

function renderReactionArea() {
  if (!appState.gameActive) {
    reactionArea.innerHTML = "";
    return;
  }

  reactionArea.innerHTML = appState.players
    .map((player) => {
      const hasTime = typeof player.reactionTime === "number";
      const disabledAttr = hasTime ? "disabled" : "";
      const label = hasTime ? `${player.name} \u2713` : player.name;
      return `
        <button
          class="rounded-2xl bg-amber-400 px-4 py-3 text-lg font-semibold text-slate-900 shadow hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-slate-200"
          data-player-id="${player.id}"
          ${disabledAttr}
        >
          ${label}
        </button>
      `;
    })
    .join("");

  reactionArea.querySelectorAll("button[data-player-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const playerId = Number(button.dataset.playerId);
      sendMessage("playerReaction", { playerId });
    });
  });
}

function renderControls() {
  const controlsDisabled =
    !socketConnected || appState.countdownRunning || appState.gameActive;

  playerNameInput.disabled = controlsDisabled;
  addPlayerButton.disabled = controlsDisabled;
  startButton.disabled = controlsDisabled;
  resetButton.disabled = !socketConnected;
}

function renderStatus() {
  if (!socketConnected && connectionStatus) {
    statusMessageEl.textContent = connectionStatus;
    return;
  }

  statusMessageEl.textContent = appState.statusMessage;
}

function render() {
  countdownDisplay.textContent = appState.countdownDisplay;
  loserDisplay.textContent = appState.loserText;
  renderPlayers();
  renderReactionArea();
  renderControls();
  renderStatus();
}

function sendMessage(type, payload = {}) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify({ type, ...payload }));
}

function scheduleReconnect() {
  if (reconnectTimer !== null) {
    return;
  }

  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, RECONNECT_DELAY);
}

function connect() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    return;
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${protocol}://${window.location.host}`);

  socket.addEventListener("open", () => {
    socketConnected = true;
    connectionStatus = "";
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    render();
  });

  socket.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      return;
    }

    if (message.type === "state" && message.state) {
      applyState(message.state);
    }
  });

  socket.addEventListener("close", () => {
    socketConnected = false;
    connectionStatus = "Disconnected from server. Reconnecting...";
    render();
    scheduleReconnect();
  });

  socket.addEventListener("error", () => {
    socketConnected = false;
    connectionStatus = "Connection error. Reconnecting...";
    render();
    scheduleReconnect();
  });
}

playerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!socketConnected) {
    return;
  }

  const name = playerNameInput.value;
  sendMessage("addPlayer", { name });
  playerNameInput.value = "";
  playerNameInput.focus();
});

startButton.addEventListener("click", () => {
  sendMessage("startCountdown");
});

resetButton.addEventListener("click", () => {
  sendMessage("resetGame");
});

render();
connect();
