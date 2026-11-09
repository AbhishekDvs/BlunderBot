import { useEffect, useRef, useCallback } from 'react'

export function useStockfish(onBestMove: (move: string) => void) {
  const workerRef = useRef<Worker | null>(null)
  const onBestMoveRef = useRef(onBestMove)

  useEffect(() => {
    onBestMoveRef.current = onBestMove
  }, [onBestMove])

  useEffect(() => {
    if (typeof window === 'undefined') return

    let worker: Worker | null = null

    try {
      worker = new Worker('/stockfish-worker.js')
      workerRef.current = worker

      worker.onmessage = (e: MessageEvent) => {
        if (typeof e.data !== 'string') return
        const line = e.data
        if (line.startsWith('bestmove')) {
          const move = line.split(' ')[1]
          if (move) {
            onBestMoveRef.current(move)
          }
        }
      }

      worker.onerror = (err) => {
        console.error('Stockfish worker error:', err)
      }
    } catch (err) {
      console.error('Failed to create Stockfish worker:', err)
    }

    return () => {
      worker?.terminate()
      workerRef.current = null
    }
  }, [])

  const postMessage = useCallback((msg: string) => {
    if (workerRef.current && typeof msg === 'string') {
      workerRef.current.postMessage(msg)
    }
  }, [])

  return { postMessage }
}
