/**
 * BlunderBot Web Audio Synthesizer
 * Zero-dependency, zero-latency procedural acoustic audio generator.
 * Creates distinct physical feedback for wood, marble, stone, and alerts.
 */

import { SoundPackId } from './themeTypes'

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

export const soundService = {
  /**
   * Procedural piece movement sound with physical material timbre.
   */
  playPieceMove(material: SoundPackId = 'wood', enabled = true) {
    if (!enabled || material === 'silent') return
    const ctx = getAudioContext()
    if (!ctx) return

    try {
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const filter = ctx.createBiquadFilter()

      // Material frequencies and resonance
      let baseFreq = 220
      let duration = 0.08
      let filterFreq = 1800

      if (material === 'wood') {
        baseFreq = 280
        duration = 0.06
        filterFreq = 2200
        osc.type = 'triangle'
      } else if (material === 'marble') {
        baseFreq = 540
        duration = 0.09
        filterFreq = 3400
        osc.type = 'sine'
      } else if (material === 'stone') {
        baseFreq = 180
        duration = 0.11
        filterFreq = 1200
        osc.type = 'sine'
      } else {
        baseFreq = 320
        duration = 0.05
        filterFreq = 2000
        osc.type = 'triangle'
      }

      osc.frequency.setValueAtTime(baseFreq * 1.5, now)
      osc.frequency.exponentialRampToValueAtTime(baseFreq, now + duration)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(filterFreq, now)

      gain.gain.setValueAtTime(0.35, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + duration)
    } catch {
      // Audio context might be restricted
    }
  },

  /**
   * Procedural capture sound with double impact and physical weight.
   */
  playPieceCapture(material: SoundPackId = 'wood', enabled = true) {
    if (!enabled || material === 'silent') return
    const ctx = getAudioContext()
    if (!ctx) return

    try {
      const now = ctx.currentTime

      // Impact 1: Victim piece being struck
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'square'
      osc1.frequency.setValueAtTime(140, now)
      osc1.frequency.exponentialRampToValueAtTime(40, now + 0.07)

      gain1.gain.setValueAtTime(0.4, now)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.07)

      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.07)

      // Impact 2: Landing square impact (with material characteristics)
      setTimeout(() => {
        this.playPieceMove(material, enabled)
      }, 35)
    } catch {
      // Audio fallback
    }
  },

  /**
   * Subtle alert chime on king in check.
   */
  playCheckAlert(enabled = true) {
    if (!enabled) return
    const ctx = getAudioContext()
    if (!ctx) return

    try {
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, now) // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.18) // A5

      gain.gain.setValueAtTime(0.25, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.35)
    } catch {
      // Audio context catch
    }
  },

  /**
   * Procedural game over sound: celebratory major triad for win, subdued tone for draw/loss.
   */
  playGameOver(result: 'win' | 'loss' | 'draw', enabled = true) {
    if (!enabled) return
    const ctx = getAudioContext()
    if (!ctx) return

    try {
      const now = ctx.currentTime
      const notes = result === 'win' ? [523.25, 659.25, 783.99, 1046.5] : [440, 415.3, 392, 349.23]

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = result === 'win' ? 'triangle' : 'sine'
        osc.frequency.setValueAtTime(freq, now + idx * 0.1)

        gain.gain.setValueAtTime(0.001, now + idx * 0.1)
        gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.1 + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.5)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now + idx * 0.1)
        osc.stop(now + idx * 0.1 + 0.5)
      })
    } catch {
      // Silent catch
    }
  },

  /**
   * Procedural 2.5D Combat Anticipation cue (gallop, ram creak, blade unsheath, staff ward)
   */
  playCombatAnticipation(attackerClass = 'P', enabled = true) {
    if (!enabled) return
    const ctx = getAudioContext()
    if (!ctx) return

    try {
      const now = ctx.currentTime
      const char = attackerClass.toUpperCase()

      if (char === 'N') {
        // Two rapid hoof beats
        ;[0, 0.14].forEach((offset) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'triangle'
          osc.frequency.setValueAtTime(125, now + offset)
          osc.frequency.exponentialRampToValueAtTime(55, now + offset + 0.06)
          gain.gain.setValueAtTime(0.22, now + offset)
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.07)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(now + offset)
          osc.stop(now + offset + 0.07)
        })
      } else if (char === 'R') {
        // Heavy timber & stone rumble
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(85, now)
        osc.frequency.linearRampToValueAtTime(65, now + 0.25)
        gain.gain.setValueAtTime(0.14, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.26)
      } else if (char === 'B') {
        // Sacred staff harmonic ward chime
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(528, now)
        osc.frequency.exponentialRampToValueAtTime(792, now + 0.22)
        gain.gain.setValueAtTime(0.16, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.24)
      } else {
        // Steel unsheath / spear ready whoosh
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(420, now)
        osc.frequency.exponentialRampToValueAtTime(980, now + 0.14)
        gain.gain.setValueAtTime(0.14, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.16)
      }
    } catch {
      // Silent catch
    }
  },

  /**
   * Procedural 3D Combat Impact with distinct weapon acoustic resonance
   */
  playCombatImpact(attackerClass = 'P', enabled = true) {
    if (!enabled) return
    const ctx = getAudioContext()
    if (!ctx) return

    try {
      const now = ctx.currentTime
      const char = attackerClass.toUpperCase()

      // Primary metallic/wooden strike oscillator
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const filter = ctx.createBiquadFilter()

      if (char === 'N' || char === 'P') {
        // Lance / Spear strike
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(680, now)
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.14)
        filter.type = 'bandpass'
        filter.frequency.setValueAtTime(1400, now)
      } else if (char === 'R') {
        // Battering Ram heavy impact
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(160, now)
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.28)
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(400, now)
      } else {
        // Sword / Staff slash (Queen, King, Bishop)
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(1250, now)
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.18)
        filter.type = 'bandpass'
        filter.frequency.setValueAtTime(2200, now)
      }

      gain.gain.setValueAtTime(0.28, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.22)

      // Secondary stone fracture crunch (noise buffer)
      const bufferSize = Math.floor(ctx.sampleRate * 0.12)
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04))
      }

      const noise = ctx.createBufferSource()
      noise.buffer = buffer
      const noiseGain = ctx.createGain()
      noiseGain.gain.setValueAtTime(0.18, now + 0.02)
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14)

      const noiseFilter = ctx.createBiquadFilter()
      noiseFilter.type = 'lowpass'
      noiseFilter.frequency.setValueAtTime(1800, now)

      noise.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(ctx.destination)

      noise.start(now + 0.02)
    } catch {
      // Silent catch
    }
  },

  /**
   * Tactile subtle UI click.
   */
  playClick(enabled = true) {
    if (!enabled) return
    const ctx = getAudioContext()
    if (!ctx) return

    try {
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, now)
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.03)

      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.03)
    } catch {
      // Silent catch
    }
  },
}
