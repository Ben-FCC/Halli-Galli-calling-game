const express = require("express");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

let nextPlayerId = 1;
let countdownTimer = null;
let reactionStart = null;
let countdownValue = 0;

const state = {
  players: [],
  countdownRunning: false,
  gameActive: false,
  countdownDisplay: "Ready",
  statusMessage: "",
  loserText: "Waiting for a round",
};

function cloneState() {
  return {
    ...state,
    players: state.players.map((player) => ({ ...player })),
  };
}

function broadcastState() {
  const message = JSON.stringify({ type: "state", state: cloneState() });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function sendState(ws) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "state", state: cloneState() }));
  }
}

function stopCountdownTimer() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  countdownValue = 0;
}

function resetPlayersReaction() {
  state.players = state.players.map((player) => ({
    ...player,
    reactionTime: null,
  }));
}

function setStatus(message) {
  state.statusMessage = message;
  broadcastState();
}

function handleAddPlayer({ name }) {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) {
    setStatus("Please enter a name before adding.");
    return;
  }

  if (state.gameActive || state.countdownRunning) {
    setStatus("Wait for the round to finish before adding players.");
    return;
  }

  state.players.push({
    id: nextPlayerId,
    name: trimmed,
    reactionTime: null,
  });
  nextPlayerId += 1;

  state.statusMessage = "";
  broadcastState();
}

function handleStartCountdown() {
  if (state.players.length < 2) {
    setStatus("Add at least two players to start.");
    return;
  }

  if (state.gameActive || state.countdownRunning) {
    setStatus("A round is already running.");
    return;
  }

  stopCountdownTimer();
  resetPlayersReaction();

  state.countdownRunning = true;
  state.gameActive = false;
  state.countdownDisplay = "3";
  state.statusMessage = "";
  state.loserText = "Waiting for a round";
  broadcastState();

  countdownValue = 3;
  countdownTimer = setInterval(() => {
    countdownValue -= 1;

    if (countdownValue > 0) {
      state.countdownDisplay = String(countdownValue);
      broadcastState();
      return;
    }

    stopCountdownTimer();
    state.countdownRunning = false;
    state.gameActive = true;
    state.countdownDisplay = "Go!";
    state.statusMessage = "Tap your button as fast as you can!";
    reactionStart = Date.now();
    broadcastState();
  }, 1000);
}

function determineLoser() {
  const reactionTimes = state.players
    .map((player) => player.reactionTime)
    .filter((time) => typeof time === "number");

  if (reactionTimes.length === 0) {
    state.loserText = "Waiting for a round";
    return;
  }

  const slowestTime = Math.max(...reactionTimes);
  const slowestPlayers = state.players.filter(
    (player) => player.reactionTime === slowestTime
  );

  if (slowestPlayers.length === 1) {
    state.loserText = `${slowestPlayers[0].name} lost with ${(slowestTime /
      1000).toFixed(2)}s.`;
    return;
  }

  const names = slowestPlayers.map((player) => player.name).join(", ");
  state.loserText = `${names} tied for last at ${(slowestTime / 1000).toFixed(
    2
  )}s.`;
}

function handlePlayerReaction({ playerId }) {
  if (!state.gameActive || reactionStart === null) {
    return;
  }

  const numericId = Number(playerId);
  const player = state.players.find((entry) => entry.id === numericId);
  if (!player || typeof player.reactionTime === "number") {
    return;
  }

  player.reactionTime = Date.now() - reactionStart;
  state.statusMessage = "";

  const pending = state.players.some(
    (entry) => typeof entry.reactionTime !== "number"
  );

  if (!pending) {
    state.gameActive = false;
    state.statusMessage = "Round complete. Reset or play again!";
    determineLoser();
    broadcastState();
    return;
  }

  broadcastState();
}

function handleResetGame() {
  stopCountdownTimer();
  state.gameActive = false;
  state.countdownRunning = false;
  state.countdownDisplay = "Ready";
  state.statusMessage = "";
  state.loserText = "Waiting for a round";
  reactionStart = null;
  resetPlayersReaction();
  broadcastState();
}

const handlers = {
  addPlayer: handleAddPlayer,
  startCountdown: handleStartCountdown,
  playerReaction: handlePlayerReaction,
  resetGame: handleResetGame,
};

wss.on("connection", (ws) => {
  sendState(ws);

  ws.on("message", (data) => {
    let message;
    try {
      message = JSON.parse(data);
    } catch (error) {
      return;
    }

    const { type, ...payload } = message;
    if (!type || !handlers[type]) {
      return;
    }

    handlers[type](payload, ws);
  });

  ws.on("close", () => {
    // No-op. We keep state between connections.
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
