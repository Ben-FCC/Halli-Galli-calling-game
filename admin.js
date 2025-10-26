"use strict";

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
  if (appState.players.length === 0) {
    playerList.innerHTML =
      '<li class="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-slate-400">No players yet. Add names to get started.</li>';
    return;
  }

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

function playerReactionStatus(player) {
  if (typeof player.reactionTime === "number") {
    return `<span class="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">${(
      player.reactionTime / 1000
    ).toFixed(2)}s</span>`;
  }

  if (appState.gameActive) {
    return '<span class="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">Waiting</span>';
  }

  if (appState.countdownRunning) {
    return '<span class="rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-700">Countdown</span>';
  }

  return '<span class="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">Ready</span>';
}

function renderReactionArea() {
  if (appState.players.length === 0) {
    reactionArea.innerHTML =
      '<p class="text-sm text-slate-500">Player reaction status will appear here during a round.</p>';
    return;
  }

  const summaryMessage = appState.gameActive
    ? "Round in progress. Waiting for player clicks..."
    : appState.countdownRunning
    ? "Countdown running. Get everyone ready."
    : "Start a round when everyone is set.";

  const cards = appState.players
    .map(
      (player) => `
        <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
          <span class="font-medium">${player.name}</span>
          ${playerReactionStatus(player)}
        </div>
      `
    )
    .join("");

  reactionArea.innerHTML = `
    <p class="col-span-full text-sm text-slate-500">${summaryMessage}</p>
    ${cards}
  `;
}

function renderControls() {
  const controlsDisabled =
    !socketConnected || appState.countdownRunning || appState.gameActive;
  const notEnoughPlayers = appState.players.length < 2;
  startButton.disabled = controlsDisabled || notEnoughPlayers;
  resetButton.disabled = !socketConnected;

  if (notEnoughPlayers) {
    startButton.title = "Add at least two players to begin.";
  } else {
    startButton.removeAttribute("title");
  }
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

startButton.addEventListener("click", () => {
  sendMessage("startCountdown");
});

resetButton.addEventListener("click", () => {
  sendMessage("resetGame");
});

render();
connect();
