# CODE BLUE LIVE — NGN NCLEX Faction Battle

A live, host-led classroom quiz. Based on the supplied Basic Adult Health Chapters 32–34 (immune function, immune deficiency/HIV, and allergic disorders). Questions are original practice items, not official NCLEX questions.

## Play

1. Deploy this app to a Node.js web host (instructions below). A static HTML host alone will NOT work.
2. Open the public site and choose **I'm the host**. Select 2–5 factions and create the room.
3. Share the displayed link or 6-digit PIN with classmates, who open the same site on their phones and select **Join a faction**.
4. Players enter nicknames and choose teams. Host starts 10, 20, or 33 questions and selects the timer.
5. Each player answers from their device. Points award both accuracy and speed; teams share points. Host can reveal early and move to next round after answers are revealed.

## Run locally

Requires Node.js 18+.

```bash
npm install
npm start
```

Open `http://localhost:3000`. Other phones cannot use localhost from their own devices; publish to a public host to play across networks.

## Deploy on Render (example)

- Create a GitHub repository and upload the contents of this folder (including `server.js`, `package.json`, `questions.json`, and `public/index.html`).
- In Render, create a **Web Service**, connect that repository, choose **Node**, set build command to `npm install` and start command to `npm start`.
- Use the HTTPS service URL Render gives you. It serves both the player website and WebSocket server.
- Use a **single application instance**: the room state currently lives in server memory. Sleeping/restarting the service clears live rooms and scores.

## Current limitations

- Scores and rooms are stored in server memory, not a database. No permanent global leaderboard, anti-cheat validation, or durable session recovery after a host restart.
- Host session can recover within the same browser tab session while the service is running. Players who disconnect midgame cannot automatically rejoin their old entry; keep stable connectivity.
- The question bank contains 33 questions. It supports multiple choice, select-all-that-apply, and ordered response. More advanced NGN interface types (matrix/bow-tie) are not yet included.
- This is a teaching game, not a secure prize contest platform. For prizes, verify winners and build identity controls before awarding a prize.

## File guide

- `server.js`: host authority, 6-digit room creation, team membership, timers, answer checking, and live score broadcasting.
- `public/index.html`: phone-friendly host and player interface.
- `questions.json`: source question bank and option-by-option rationales.
