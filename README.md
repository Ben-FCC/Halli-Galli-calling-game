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

The server listens on port 3000 by default. Open `http://localhost:3000/admin` in any browser to manage the game, and share `http://localhost:3000/` so that everyone connects to the player console on the same session.

## Gameplay

- Add the player names from the admin page.
- Press **Start countdown** on the admin page to begin a round. The server runs the countdown and shares the state with all connected clients.
- Each player selects their name on the player page and taps the **Click!** button as soon as "Go!" appears. The slowest reaction is shown as the loser.
- Use **Reset** on the admin page to prepare for the next round.
