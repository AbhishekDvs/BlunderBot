let engine;

try {
  engine = new Worker('stockfish.js');
} catch (err) {
  postMessage('Failed to load stockfish.js: ' + err.message);
}

onmessage = (e) => {
  if (engine) {
    engine.postMessage(e.data);
  }
};

if (engine) {
  engine.onmessage = (event) => {
    postMessage(event.data);
  };
}
