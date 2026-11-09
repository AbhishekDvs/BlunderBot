let engine;

try {
  engine = new Worker('stockfish.js');
} catch (err) {
  postMessage('Failed to load stockfish.js: ' + (err && err.message ? err.message : String(err)));
}

onmessage = (e) => {
  if (engine && typeof e.data === 'string') {
    engine.postMessage(e.data);
  }
};

if (engine) {
  engine.onmessage = (event) => {
    postMessage(event.data);
  };
  engine.onerror = (err) => {
    console.error('Stockfish internal worker error:', err);
  };
}

self.onerror = (err) => {
  console.error('Stockfish wrapper worker error:', err);
};
