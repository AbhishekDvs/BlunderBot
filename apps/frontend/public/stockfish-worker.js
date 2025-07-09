// public/stockfish-worker.js
importScripts('stockfish.js');
const engine = STOCKFISH();

onmessage = e => {
  engine.postMessage(e.data);
};

engine.onmessage = event => {
  postMessage(event.data);
};
