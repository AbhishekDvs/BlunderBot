'use client'

import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Provides modal dialog focus management:
 * - Captures trigger focus before opening and restores it on close
 * - Traps Tab / Shift+Tab navigation inside the dialog container
 * - Closes cleanly on Escape
 */
export function useModalAccessibility(
  isOpen: boolean,
  dialogRef: React.RefObject<HTMLElement | null>,
  onClose: () => void
) {
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return

    previousFocusRef.current = document.activeElement as HTMLElement | null

    const focusFirst = () => {
      const container = dialogRef.current
      if (!container) return
      if (container.contains(document.activeElement)) return
      const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusables.length > 0) {
        focusables[0].focus()
      } else {
        container.focus()
      }
    }

    const rafId = requestAnimationFrame(focusFirst)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }

      if (e.key !== 'Tab') return
      const container = dialogRef.current
      if (!container) return
      const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (e.shiftKey) {
        if (!active || active === first || !container.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else if (!active || active === last || !container.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('keydown', handleKeyDown)
      const prev = previousFocusRef.current
      if (prev && prev.isConnected && typeof prev.focus === 'function') {
        prev.focus()
      }
      previousFocusRef.current = null
    }
  }, [isOpen, dialogRef])
}
