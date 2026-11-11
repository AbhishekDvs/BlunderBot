import { Chess } from 'chess.js'
import type { AnimationPacing } from './types.ts'

export const VISUAL_PHASES = ['QUEUED', 'PREPARING', 'APPROACHING', 'CONTACT', 'IMPACT', 'DESTRUCTION', 'SETTLEMENT', 'COMPLETE'] as const
export type VisualPhase = typeof VISUAL_PHASES[number]
export interface VisualIdentity { readonly id: string; readonly code: string }
export type VisualPosition = Readonly<Record<string, VisualIdentity>>
export interface VisualMoveInput {
  from: string
  to: string
  pieceCode: string
  beforeFen?: string
  afterFen?: string
  moveId?: string
  promotion?: string
  pacing: AnimationPacing
}
export interface VisualMoveEvent {
  readonly id: string
  readonly generation: number
  readonly from: string
  readonly to: string
  readonly beforeFen: string
  readonly afterFen: string
  readonly before: VisualPosition
  readonly after: VisualPosition
  readonly attacker: VisualIdentity
  readonly defender?: VisualIdentity
  readonly capturedSquare?: string
  readonly promotion?: string
  readonly rookMove?: Readonly<{ from: string; to: string; instance: VisualIdentity }>
  readonly faction: string
  readonly pieceClass: string
  readonly animation: Readonly<{ pacing: AnimationPacing; contactFrame: number; initialState: 'QUEUED' }>
}
export interface VisualEventRecord {
  readonly event: VisualMoveEvent
  phase: VisualPhase
  readonly transitions: VisualPhase[]
  skipped: boolean
}

export function fenPieces(fen: string): Record<string, string> {
  const result: Record<string, string> = {}
  fen.split(' ')[0].split('/').forEach((row, rank) => {
    let file = 0
    for (const char of row) {
      if (/\d/.test(char)) file += Number(char)
      else { result[`${'abcdefgh'[file++]}${8-rank}`] = `${char === char.toUpperCase() ? 'w' : 'b'}${char.toUpperCase()}` }
    }
  })
  return result
}

/** Chess advances immediately; presentation consumes immutable snapshots in order. */
export class VisualEventQueue {
  public generation = 0
  public tailFen = ''
  public tail: VisualPosition = Object.freeze({})
  public active: VisualEventRecord | null = null
  public readonly pending: VisualEventRecord[] = []
  public readonly history: VisualEventRecord[] = []
  private sequence = 0
  private identities = 0
  private seen = new Set<string>()

  public reset(fen: string) {
    this.generation++
    this.active = null
    this.pending.length = 0
    this.history.length = 0
    this.seen.clear()
    this.tailFen = fen
    this.tail = Object.freeze(Object.fromEntries(Object.entries(fenPieces(fen)).map(([sq,code]) => [sq, this.identity(code)])))
  }

  private identity(code: string): VisualIdentity {
    return Object.freeze({ id: `unit-${this.generation}-${++this.identities}`, code })
  }

  public enqueue(input: VisualMoveInput): VisualMoveEvent | null {
    if (input.moveId && this.seen.has(input.moveId)) return null
    const beforeFen = input.beforeFen ?? this.tailFen
    if (beforeFen !== this.tailFen) throw new Error('Visual move does not follow the queued position')
    const chess = new Chess(beforeFen)
    const move = chess.move({ from: input.from, to: input.to, promotion: input.promotion })
    const afterFen = chess.fen()
    if (input.afterFen && input.afterFen !== afterFen) throw new Error('Visual event after-FEN disagrees with the validated move')
    const attacker = this.tail[input.from]
    if (!attacker || attacker.code !== input.pieceCode) throw new Error('Visual attacker identity disagrees with before-FEN')
    const capturedSquare = move.captured ? (move.isEnPassant() ? `${move.to[0]}${move.from[1]}` : move.to) : undefined
    const defender = capturedSquare ? this.tail[capturedSquare] : undefined
    if (move.captured && !defender) throw new Error('Missing captured instance in visual snapshot')
    const next = { ...this.tail }
    delete next[input.from]
    if (capturedSquare) delete next[capturedSquare]
    next[input.to] = move.promotion ? Object.freeze({ id: attacker.id, code: `${move.color}${move.promotion.toUpperCase()}` }) : attacker
    let rookMove: VisualMoveEvent['rookMove']
    if (move.isKingsideCastle() || move.isQueensideCastle()) {
      const from = `${move.isKingsideCastle() ? 'h' : 'a'}${move.from[1]}`
      const to = `${move.isKingsideCastle() ? 'f' : 'd'}${move.from[1]}`
      rookMove = Object.freeze({ from, to, instance: next[from] })
      next[to] = next[from]
      delete next[from]
    }
    const event: VisualMoveEvent = Object.freeze({
      id: input.moveId ?? `move-${this.generation}-${++this.sequence}`, generation: this.generation,
      from: input.from, to: input.to, beforeFen, afterFen, before: this.tail, after: Object.freeze(next),
      attacker, defender, capturedSquare, promotion: move.promotion, rookMove,
      faction: move.color, pieceClass: move.piece.toUpperCase(),
      animation: Object.freeze({ pacing: input.pacing, contactFrame: 4, initialState: 'QUEUED' }),
    })
    this.seen.add(event.id)
    this.tail = event.after
    this.tailFen = afterFen
    this.pending.push({ event, phase: 'QUEUED', transitions: ['QUEUED'], skipped: false })
    return event
  }

  public begin(): VisualMoveEvent | null {
    if (this.active || !this.pending.length) return null
    this.active = this.pending.shift()!
    this.transition(this.active.event.id, 'PREPARING')
    return this.active.event
  }

  public transition(id: string, phase: VisualPhase) {
    if (!this.active || this.active.event.id !== id || this.active.event.generation !== this.generation) return false
    const from = VISUAL_PHASES.indexOf(this.active.phase)
    const to = VISUAL_PHASES.indexOf(phase)
    if (to < from) return false
    for (let i = from+1; i <= to; i++) this.active.transitions.push(VISUAL_PHASES[i])
    this.active.phase = phase
    return true
  }

  public complete(id: string, skipped = false): VisualMoveEvent | null {
    if (!this.transition(id, 'COMPLETE')) return null
    const record = this.active!
    record.skipped = skipped
    this.history.push(record)
    if (this.history.length > 128) this.history.shift()
    this.active = null
    return record.event
  }

  public recognizes(fen: string) {
    return this.tailFen === fen || this.active?.event.beforeFen === fen || this.active?.event.afterFen === fen ||
      this.pending.some(({event}) => event.beforeFen === fen || event.afterFen === fen)
  }

  public get busy() { return !!this.active || this.pending.length > 0 }
}
