import { useEffect, useRef } from 'react'

export function useStockfish(onBestMove: (move: string) => void) {
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    let worker: Worker | null = null

    try {
      worker = new Worker('/stockfish-worker.js')
      workerRef.current = worker

      worker.onmessage = (e) => {
        const line = e.data as string
        console.log('[STOCKFISH]', e.data); 
        if (typeof line === 'string' && line.startsWith('bestmove')) {
          const move = line.split(' ')[1]
          if (move) {
            onBestMove(move)
          }
        }
      }
    } catch (err) {
      console.error('Failed to create Stockfish worker:', err)
    }

    return () => {
      worker?.terminate()
    }
  }, [onBestMove])

  const postMessage = (msg: string) => {
    if (workerRef.current) {
      workerRef.current.postMessage(msg)
    }
  }

  return { postMessage }
}
