# Halli Galli Calling Game

This version of the Halli Galli countdown game uses a small Node.js server so multiple browsers can share the same round.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the server:

   ```bash
   npm start
   ```

The server listens on port 3000 by default. Open `http://localhost:3000` in any browser on the same network (or share the host's IP address) so that everyone connects to the same game session.

## Gameplay

- Add the player names from any connected browser.
- Press **Start countdown** to begin a round. The server runs the countdown and shares the state with all connected clients.
- Each player taps their button as soon as "Go!" appears. The slowest reaction is shown as the loser.
- Use **Reset** to prepare for the next round.
