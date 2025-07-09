import { useEffect, useRef } from 'react';

export function useStockfish(onMessage: (msg: string) => void) {
  const workerRef = useRef<Worker | null>(null);
  useEffect(() => {
  const worker = new Worker('/stockfish-worker.js');
  workerRef.current = worker;

  worker.onmessage = (e) => {
    const line = e.data;

    if (typeof line === 'string' && line.startsWith('bestmove')) {
      const [, move] = line.split(' ');
      onMessage(move); 
    }
  };

  return () => {
    worker.terminate();
  };
}, [onMessage]);

  const postMessage = (msg: string) => {
    if (workerRef.current) {
    workerRef.current.postMessage(msg);
    }
    };
  return { postMessage };
}
