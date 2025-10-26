"use strict";

const countdownDisplay = document.querySelector("#countdownDisplay");
const loserDisplay = document.querySelector("#loserDisplay");
const statusMessageEl = document.querySelector("#statusMessage");
const joinForm = document.querySelector("#joinForm");
const playerNameInput = document.querySelector("#playerNameInput");
const joinButton = document.querySelector("#joinButton");
const joinStatusEl = document.querySelector("#joinStatus");
const playerSelect = document.querySelector("#playerSelect");
const selectionHint = document.querySelector("#selectionHint");
const clickButton = document.querySelector("#clickButton");
const playerFeedback = document.querySelector("#playerFeedback");
const playersList = document.querySelector("#playersList");

let socket = null;
let socketConnected = false;
let connectionStatus = "Connecting to server...";
let reconnectTimer = null;
const RECONNECT_DELAY = 2000;

let pendingJoin = null;
let joinStatusText = "";
let joinStatusVariant = "info";

const appState = {
  players: [],
  countdownDisplay: "Ready",
  statusMessage: "",
  loserText: "Waiting for a round",
  gameActive: false,
  countdownRunning: false,
};

let selectedPlayerId = null;

function generateRequestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function setJoinStatus(message, variant = "info") {
  joinStatusText = message;
  joinStatusVariant = variant;
}

function renderJoinStatus() {
  if (!joinStatusEl) {
    return;
  }

  joinStatusEl.textContent = joinStatusText;

  let colorClass = "text-slate-500";
  if (joinStatusVariant === "error") {
    colorClass = "text-rose-500";
  } else if (joinStatusVariant === "success") {
    colorClass = "text-emerald-600";
  }

  joinStatusEl.className = `text-sm min-h-[1.5rem] ${colorClass}`;
}

function renderJoinControls() {
  if (!playerNameInput || !joinButton) {
    return;
  }

  const gameLocked = appState.countdownRunning || appState.gameActive;
  const connectionLocked = !socketConnected;
  const waiting = pendingJoin !== null;

  const disableInput = gameLocked || connectionLocked || waiting;
  playerNameInput.disabled = disableInput;

  const trimmed = playerNameInput.value.trim();
  const disableButton = disableInput || trimmed.length === 0;
  joinButton.disabled = disableButton;

  joinButton.textContent = waiting ? "Joining..." : "Join game";
}

function loadSelection() {
  try {
    const stored = window.localStorage.getItem("hg-selected-player-id");
    if (stored) {
      const parsed = Number.parseInt(stored, 10);
      if (!Number.isNaN(parsed)) {
        selectedPlayerId = parsed;
      }
    }
  } catch (error) {
    selectedPlayerId = null;
  }
}

function saveSelection() {
  try {
    if (selectedPlayerId === null) {
      window.localStorage.removeItem("hg-selected-player-id");
      return;
    }

    window.localStorage.setItem(
      "hg-selected-player-id",
      String(selectedPlayerId)
    );
  } catch (error) {
    // Ignore storage errors (e.g., private browsing)
  }
}

function getSelectedPlayer() {
  return appState.players.find((player) => player.id === selectedPlayerId);
}

function completePendingJoin(player, { requestId, matchName = false } = {}) {
  if (!pendingJoin) {
    return false;
  }

  if (requestId && pendingJoin.requestId !== requestId) {
    return false;
  }

  if (matchName && pendingJoin.name !== player.name) {
    return false;
  }

  selectedPlayerId = player.id;
  saveSelection();
  pendingJoin = null;
  if (playerNameInput) {
    playerNameInput.value = "";
  }
  setJoinStatus(`You're in as ${player.name}.`, "success");
  return true;
}

function reconcilePendingJoin(previousPlayers) {
  if (!pendingJoin) {
    return;
  }

  const previousIds = new Set(previousPlayers.map((player) => player.id));

  for (const player of appState.players) {
    if (previousIds.has(player.id)) {
      continue;
    }

    if (completePendingJoin(player, { matchName: true })) {
      break;
    }
  }
}

function playerStatusBadge(player) {
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

function renderPlayersList() {
  if (appState.players.length === 0) {
    playersList.innerHTML =
      '<li class="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-slate-400">Waiting for players to join.</li>';
    return;
  }

  playersList.innerHTML = appState.players
    .map(
      (player) => `
        <li class="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
          <span class="font-medium">${player.name}</span>
          ${playerStatusBadge(player)}
        </li>
      `
    )
    .join("");
}

function renderSelectionOptions() {
  const options = [
    '<option value="">Select your name</option>',
    ...appState.players.map(
      (player) => `<option value="${player.id}">${player.name}</option>`
    ),
  ];

  playerSelect.innerHTML = options.join("");

  const playerExists = appState.players.some(
    (player) => player.id === selectedPlayerId
  );

  if (!playerExists) {
    selectedPlayerId = null;
    saveSelection();
  }

  if (selectedPlayerId !== null) {
    playerSelect.value = String(selectedPlayerId);
  }

  if (appState.players.length === 0) {
    selectionHint.textContent =
      "No players yet. Add yourself above to get things started.";
    return;
  }

  selectionHint.textContent =
    "Select your name to link this device. If you don't see it, join above.";
}

function renderStatus() {
  if (!socketConnected && connectionStatus) {
    statusMessageEl.textContent = connectionStatus;
    return;
  }

  statusMessageEl.textContent = appState.statusMessage;
}

function renderPlayerFeedback() {
  const selectedPlayer = getSelectedPlayer();
  if (!selectedPlayer) {
    playerFeedback.textContent = "Join the game above to get ready.";
    return;
  }

  if (typeof selectedPlayer.reactionTime === "number") {
    playerFeedback.textContent = `Your reaction time: ${(
      selectedPlayer.reactionTime / 1000
    ).toFixed(2)}s. Wait for the admin to reset.`;
    return;
  }

  if (appState.gameActive) {
    playerFeedback.textContent = "Tap the button now!";
    return;
  }

  if (appState.countdownRunning) {
    playerFeedback.textContent = "Get ready... the countdown is running.";
    return;
  }

  playerFeedback.textContent = "Hold tight. The admin will start the next round.";
}

function renderButtonState() {
  const selectedPlayer = getSelectedPlayer();
  const alreadyClicked =
    selectedPlayer && typeof selectedPlayer.reactionTime === "number";
  const canClick =
    socketConnected &&
    appState.gameActive &&
    Boolean(selectedPlayer) &&
    !alreadyClicked;

  clickButton.disabled = !canClick;

  if (!canClick) {
    return;
  }

  clickButton.focus({ preventScroll: true });
}

function render() {
  countdownDisplay.textContent = appState.countdownDisplay;
  loserDisplay.textContent = appState.loserText;
  renderSelectionOptions();
  renderStatus();
  renderPlayersList();
  renderPlayerFeedback();
  renderButtonState();
  renderJoinControls();
  renderJoinStatus();
}

function applyState(newState) {
  const previousPlayers = appState.players.slice();
  appState.players = newState.players || [];
  appState.countdownDisplay = newState.countdownDisplay || "Ready";
  appState.statusMessage = newState.statusMessage || "";
  appState.loserText = newState.loserText || "Waiting for a round";
  appState.gameActive = Boolean(newState.gameActive);
  appState.countdownRunning = Boolean(newState.countdownRunning);
  reconcilePendingJoin(previousPlayers);
  render();
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
    if (pendingJoin) {
      pendingJoin = null;
    }
    setJoinStatus("", "info");
    render();
  });

  socket.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      return;
    }

    if (!message || !message.type) {
      return;
    }

    if (message.type === "state" && message.state) {
      applyState(message.state);
      return;
    }

    if (message.type === "playerAdded" && message.player) {
      const updated = completePendingJoin(message.player, {
        requestId: message.requestId,
      });
      if (updated) {
        render();
      }
      return;
    }

    if (message.type === "playerAddRejected") {
      if (!pendingJoin) {
        return;
      }

      if (message.requestId && pendingJoin.requestId !== message.requestId) {
        return;
      }

      pendingJoin = null;
      setJoinStatus(message.reason || "Unable to join right now.", "error");
      render();
    }
  });

  socket.addEventListener("close", () => {
    socketConnected = false;
    connectionStatus = "Disconnected from server. Reconnecting...";
    if (pendingJoin) {
      pendingJoin = null;
    }
    setJoinStatus("Connection lost. Waiting to reconnect...", "error");
    render();
    scheduleReconnect();
  });

  socket.addEventListener("error", () => {
    socketConnected = false;
    connectionStatus = "Connection error. Reconnecting...";
    if (pendingJoin) {
      pendingJoin = null;
    }
    setJoinStatus("Connection error. Waiting to reconnect...", "error");
    render();
    scheduleReconnect();
  });
}

if (playerNameInput) {
  playerNameInput.addEventListener("input", () => {
    if (joinStatusVariant === "error" && joinStatusText) {
      setJoinStatus("", "info");
      renderJoinStatus();
    }
    renderJoinControls();
  });
}

if (joinForm) {
  joinForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!socketConnected || pendingJoin) {
      return;
    }

    const name = playerNameInput ? playerNameInput.value.trim() : "";

    if (!name) {
      setJoinStatus("Please enter your name before joining.", "error");
      render();
      return;
    }

    if (appState.countdownRunning || appState.gameActive) {
      setJoinStatus("Wait for the round to finish before joining.", "error");
      render();
      return;
    }

    const requestId = generateRequestId();
    pendingJoin = { requestId, name };
    setJoinStatus("Adding you to the game...", "info");
    render();
    sendMessage("addPlayer", { name, requestId });
  });
}

playerSelect.addEventListener("change", () => {
  const value = playerSelect.value;
  selectedPlayerId = value ? Number(value) : null;
  if (Number.isNaN(selectedPlayerId)) {
    selectedPlayerId = null;
  }
  saveSelection();
  render();
});

clickButton.addEventListener("click", () => {
  const selectedPlayer = getSelectedPlayer();
  if (!selectedPlayer) {
    return;
  }

  sendMessage("playerReaction", { playerId: selectedPlayer.id });
  clickButton.disabled = true;
});

loadSelection();
render();
connect();
