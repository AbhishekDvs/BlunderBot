'use client'

import { useEffect, useState } from 'react'

export function useReducedMotion() {
  // Start conservatively until the browser's preference is available.
  const [reducedMotion, setReducedMotion] = useState(true)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return reducedMotion
}
