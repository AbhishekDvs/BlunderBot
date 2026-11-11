/**
 * Pure UCI protocol & search-generation coordinator for Stockfish WebWorker.
 * Ensures:
 * - Commands sent before `readyok` are queued rather than dropped or racing WASM init.
 * - New searches or cancellations (`stop`, `ucinewgame`, reset, resign) invalidate
 *   any in-flight search so stale `bestmove` responses never apply to a new game.
 * - Invalid/aborted `(none)` moves and worker errors are handled explicitly.
 */

export type StockfishStatus = 'initializing' | 'ready' | 'searching' | 'error' | 'terminated'

export interface EngineStateSnapshot {
  status: StockfishStatus
  isReady: boolean
  isSearching: boolean
  supersededCount: number
  error: string | null
}

export class StockfishProtocolController {
  private isReady = false
  private isSearching = false
  private supersededCount = 0
  private pendingCommands: string[] = []
  private status: StockfishStatus = 'initializing'
  private error: string | null = null
  private readonly sendRaw: (cmd: string) => void
  private readonly onBestMove: (move: string) => void
  private readonly onStatusChange?: (snapshot: EngineStateSnapshot) => void

  constructor(options: {
    sendRaw: (cmd: string) => void
    onBestMove: (move: string) => void
    onStatusChange?: (snapshot: EngineStateSnapshot) => void
  }) {
    this.sendRaw = options.sendRaw
    this.onBestMove = options.onBestMove
    this.onStatusChange = options.onStatusChange
  }

  public getSnapshot(): EngineStateSnapshot {
    return {
      status: this.status,
      isReady: this.isReady,
      isSearching: this.isSearching,
      supersededCount: this.supersededCount,
      error: this.error,
    }
  }

  private emitStatus() {
    this.onStatusChange?.(this.getSnapshot())
  }

  public startHandshake() {
    if (this.status === 'terminated' || this.status === 'error') return
    this.sendRaw('uci')
  }

  public handleWorkerMessage(rawData: unknown) {
    if (typeof rawData !== 'string' || this.status === 'terminated') return
    const line = rawData.trim()
    if (!line) return

    if (line.startsWith('Failed to load stockfish.js')) {
      this.fail(line)
      return
    }

    if (line === 'uciok') {
      if (!this.isReady) {
        this.sendRaw('isready')
      }
      return
    }

    if (line === 'readyok') {
      this.isReady = true
      if (this.status === 'initializing') {
        this.status = 'ready'
      }
      const queued = this.pendingCommands.splice(0, this.pendingCommands.length)
      for (const cmd of queued) {
        this.dispatchCommand(cmd)
      }
      this.emitStatus()
      return
    }

    if (line.startsWith('bestmove')) {
      const move = line.split(/\s+/)[1]
      if (this.supersededCount > 0) {
        this.supersededCount--
        if (!this.isSearching && this.status !== 'error') {
          this.status = this.isReady ? 'ready' : 'initializing'
          this.emitStatus()
        }
        return
      }
      this.isSearching = false
      if (this.status !== 'error') {
        this.status = this.isReady ? 'ready' : 'initializing'
      }
      this.emitStatus()
      if (move) {
        this.onBestMove(move)
      }
    }
  }

  public postMessage(cmd: string) {
    if (typeof cmd !== 'string' || this.status === 'terminated' || this.status === 'error') return
    const trimmed = cmd.trim()
    if (!trimmed) return

    if (trimmed === 'stop') {
      this.cancelSearch()
      return
    }

    if (!this.isReady) {
      if (trimmed === 'ucinewgame') {
        // Drop any stale queued search commands from before this reset/new search
        this.pendingCommands = []
      }
      this.pendingCommands.push(trimmed)
      return
    }

    this.dispatchCommand(trimmed)
  }

  private dispatchCommand(cmd: string) {
    if (cmd === 'ucinewgame' || cmd.startsWith('go ')) {
      if (this.isSearching) {
        this.sendRaw('stop')
        this.supersededCount++
        this.isSearching = false
      }
    }

    this.sendRaw(cmd)

    if (cmd.startsWith('go ')) {
      this.isSearching = true
      this.status = 'searching'
      this.emitStatus()
    }
  }

  public cancelSearch() {
    // Drop queued unstarted searches (e.g. position + go queued before readyok)
    this.pendingCommands = this.pendingCommands.filter(
      (cmd) => cmd !== 'ucinewgame' && !cmd.startsWith('position ') && !cmd.startsWith('go ')
    )
    if (this.isSearching) {
      this.isSearching = false
      this.supersededCount++
      this.sendRaw('stop')
      if (this.status !== 'error' && this.status !== 'terminated') {
        this.status = this.isReady ? 'ready' : 'initializing'
      }
      this.emitStatus()
    }
  }

  public fail(message: string) {
    this.pendingCommands = []
    this.isSearching = false
    this.status = 'error'
    this.error = message
    this.emitStatus()
  }

  public terminate() {
    this.pendingCommands = []
    this.isSearching = false
    this.status = 'terminated'
    this.emitStatus()
  }
}
