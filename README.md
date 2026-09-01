# Mulatschak

A real-time, four-player browser implementation of the Mulatschak card game.

## Development

Requires Node.js 22 or newer.

```sh
npm install
npm start
```

The game is available at `http://localhost:3000`.

```sh
npm test
npm run lint
```

Game state is held in memory, so restarting the server resets all rooms.
