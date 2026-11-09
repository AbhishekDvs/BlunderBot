/** Presentation only. Never use these durations to schedule chess moves. */
export type MotionPreference = 'system' | 'reduced' | 'off'

export function boardAnimationDuration(
  preference: MotionPreference,
  systemReducedMotion: boolean,
  side: 'white' | 'black',
): number {
  // Preserve the existing black-orientation workaround.
  if (side === 'black' || preference === 'off') return 0
  if (preference === 'reduced' || systemReducedMotion) return 100
  return 300
}
