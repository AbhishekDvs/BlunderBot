import { useEffect, useRef, useCallback, useState } from 'react'
import { astraHub } from '@/theme/astraIntegration'
import {
  StockfishProtocolController,
  type EngineStateSnapshot,
} from '@/lib/stockfish/engineProtocol'

const INITIAL_SNAPSHOT: EngineStateSnapshot = {
  status: 'initializing',
  isReady: false,
  isSearching: false,
  supersededCount: 0,
  error: null,
}

let currentEngineSnapshot: EngineStateSnapshot = INITIAL_SNAPSHOT
const statusListeners = new Set<(snapshot: EngineStateSnapshot) => void>()

function publishEngineSnapshot(snapshot: EngineStateSnapshot) {
  currentEngineSnapshot = snapshot
  statusListeners.forEach((listener) => {
    try {
      listener(snapshot)
    } catch {
      // Ignore listener errors
    }
  })
}

export function useStockfishStatus(): EngineStateSnapshot {
  const [snapshot, setSnapshot] = useState<EngineStateSnapshot>(currentEngineSnapshot)

  useEffect(() => {
    setSnapshot(currentEngineSnapshot)
    statusListeners.add(setSnapshot)
    return () => {
      statusListeners.delete(setSnapshot)
    }
  }, [])

  return snapshot
}

export function useStockfish(onBestMove: (move: string) => void) {
  const workerRef = useRef<Worker | null>(null)
  const protocolRef = useRef<StockfishProtocolController | null>(null)
  const onBestMoveRef = useRef(onBestMove)
  const [engineState, setEngineState] = useState<EngineStateSnapshot>(INITIAL_SNAPSHOT)

  useEffect(() => {
    onBestMoveRef.current = onBestMove
  }, [onBestMove])

  useEffect(() => {
    if (typeof window === 'undefined') return

    let worker: Worker | null = null
    const protocol = new StockfishProtocolController({
      sendRaw: (cmd) => {
        try {
          workerRef.current?.postMessage(cmd)
        } catch (err) {
          protocol.fail(err instanceof Error ? err.message : 'Failed to post command to Stockfish worker.')
        }
      },
      onBestMove: (move) => {
        onBestMoveRef.current(move)
      },
      onStatusChange: (snapshot) => {
        setEngineState(snapshot)
        publishEngineSnapshot(snapshot)
      },
    })
    protocolRef.current = protocol

    try {
      worker = new Worker('/stockfish-worker.js')
      workerRef.current = worker

      worker.onmessage = (e: MessageEvent) => {
        protocol.handleWorkerMessage(e.data)
      }

      worker.onerror = (err) => {
        const message = err?.message || 'Stockfish chess engine worker encountered a runtime error.'
        console.error('Stockfish worker error:', err)
        protocol.fail(message)
      }

      worker.onmessageerror = () => {
        const message = 'Stockfish worker message deserialization failed.'
        console.error(message)
        protocol.fail(message)
      }

      protocol.startHandshake()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize Stockfish worker.'
      console.error('Failed to create Stockfish worker:', err)
      protocol.fail(message)
    }

    const unsubReset = astraHub.onGameReset(() => {
      protocol.cancelSearch()
    })
    const unsubEnd = astraHub.onGameEnd(() => {
      protocol.cancelSearch()
    })

    return () => {
      unsubReset()
      unsubEnd()
      protocol.terminate()
      protocolRef.current = null
      try {
        worker?.postMessage('quit')
      } catch {
        // Worker may already be closed
      }
      worker?.terminate()
      workerRef.current = null
      publishEngineSnapshot(INITIAL_SNAPSHOT)
    }
  }, [])

  const postMessage = useCallback((msg: string) => {
    if (typeof msg === 'string') {
      protocolRef.current?.postMessage(msg)
    }
  }, [])

  const stopSearch = useCallback(() => {
    protocolRef.current?.cancelSearch()
  }, [])

  return {
    postMessage,
    stopSearch,
    isReady: engineState.isReady,
    isSearching: engineState.isSearching,
    status: engineState.status,
    error: engineState.error,
  }
}
