'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import {
  BoardPreset,
  PieceSet,
  ThemeSettings,
  BoardPresetId,
  PieceSetId,
  BoardPerspective,
  SoundPackId
} from './themeTypes'
import {
  BOARD_PRESETS,
  PIECE_SETS,
  DEFAULT_THEME_SETTINGS,
  enforceAssetAvailability
} from './themePresets'

interface ThemeContextValue {
  isHydrated: boolean
  settings: ThemeSettings
  activePreset: BoardPreset
  activePieceSet: PieceSet
  setBoardPreset: (id: BoardPresetId) => void
  setPieceSet: (id: PieceSetId) => void
  setPerspective: (perspective: BoardPerspective) => void
  setSoundPack: (soundPackId: SoundPackId) => void
  toggleSound: () => void
  toggleCoordinates: () => void
  togglePerspective: () => void
  updateSettings: (partial: Partial<ThemeSettings>) => void
  resetToDefaults: () => void
  isCustomizerOpen: boolean
  setIsCustomizerOpen: (open: boolean) => void
}

const STORAGE_KEY = 'blunderbot_theme_v2'

const ThemeContext = createContext<ThemeContextValue | null>(null)

const VALID_PERSPECTIVES: readonly BoardPerspective[] = ['flat-2d', 'elevated-2.5d', 'true-3d']
const VALID_SOUND_PACKS: readonly SoundPackId[] = ['wood', 'marble', 'stone', 'soft', 'silent']

function sanitizeSettings(raw: Partial<ThemeSettings>, base: ThemeSettings): ThemeSettings {
  const validPresetId = raw.boardPresetId && BOARD_PRESETS[raw.boardPresetId]
    ? raw.boardPresetId
    : base.boardPresetId
  const validPieceSetId = raw.pieceSetId && PIECE_SETS[raw.pieceSetId]?.isAvailable
    ? raw.pieceSetId
    : base.pieceSetId
  const perspective = raw.perspective && VALID_PERSPECTIVES.includes(raw.perspective)
    ? raw.perspective
    : base.perspective
  const soundPackId = raw.soundPackId && VALID_SOUND_PACKS.includes(raw.soundPackId)
    ? raw.soundPackId
    : base.soundPackId
  const animationDuration =
    typeof raw.animationDuration === 'number' && Number.isFinite(raw.animationDuration) && raw.animationDuration >= 0
      ? raw.animationDuration
      : base.animationDuration

  return enforceAssetAvailability({
    ...base,
    boardPresetId: validPresetId,
    pieceSetId: validPieceSetId,
    perspective,
    soundPackId,
    animationDuration,
    showCoordinates: typeof raw.showCoordinates === 'boolean' ? raw.showCoordinates : base.showCoordinates,
    soundEnabled: typeof raw.soundEnabled === 'boolean' ? raw.soundEnabled : base.soundEnabled,
    showMoveHints: typeof raw.showMoveHints === 'boolean' ? raw.showMoveHints : base.showMoveHints,
    experimental3d: typeof raw.experimental3d === 'boolean' ? raw.experimental3d : base.experimental3d,
  })
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_THEME_SETTINGS)
  const [isHydrated, setIsHydrated] = useState(false)
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false)

  // Hydrate from localStorage once mounted
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ThemeSettings>
        if (parsed && typeof parsed === 'object') {
          setSettings((prev) => sanitizeSettings(parsed, prev))
        }
      }
    } catch {
      // Fallback to default settings
    }
    setIsHydrated(true)
  }, [])

  // Persist to localStorage when changed (only after hydration)
  useEffect(() => {
    if (!isHydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // Ignore storage errors (e.g. incognito quota)
    }
  }, [settings, isHydrated])

  const activePreset = useMemo(
    () => BOARD_PRESETS[settings.boardPresetId] || BOARD_PRESETS['classic-tournament'],
    [settings.boardPresetId]
  )

  const activePieceSet = useMemo(
    () => PIECE_SETS[settings.pieceSetId] || PIECE_SETS['default'],
    [settings.pieceSetId]
  )

  const setBoardPreset = useCallback((id: BoardPresetId) => {
    if (BOARD_PRESETS[id]) {
      setSettings((prev) => ({
        ...prev,
        boardPresetId: id,
        soundPackId: BOARD_PRESETS[id].defaultSoundPack,
      }))
    }
  }, [])

  const setPieceSet = useCallback((id: PieceSetId) => {
    if (PIECE_SETS[id]?.isAvailable) {
      setSettings((prev) => ({
        ...prev,
        pieceSetId: id,
        perspective: id === 'astra-medieval' ? 'true-3d' : (prev.perspective === 'true-3d' ? 'flat-2d' : prev.perspective),
      }))
    }
  }, [])

  const setPerspective = useCallback((perspective: BoardPerspective) => {
    setSettings((prev) => ({
      ...prev,
      perspective,
      pieceSetId: perspective === 'true-3d'
        ? 'astra-medieval'
        : (prev.pieceSetId === 'astra-medieval' ? 'default' : prev.pieceSetId),
    }))
  }, [])

  const setSoundPack = useCallback((soundPackId: SoundPackId) => {
    setSettings((prev) => ({ ...prev, soundPackId }))
  }, [])

  const toggleSound = useCallback(() => {
    setSettings((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))
  }, [])

  const toggleCoordinates = useCallback(() => {
    setSettings((prev) => ({ ...prev, showCoordinates: !prev.showCoordinates }))
  }, [])

  const togglePerspective = useCallback(() => {
    setSettings((prev) => {
      const order: BoardPerspective[] = ['true-3d', 'elevated-2.5d', 'flat-2d']
      const nextIdx = (order.indexOf(prev.perspective) + 1) % order.length
      const nextPerspective = order[nextIdx]
      return {
        ...prev,
        perspective: nextPerspective,
        pieceSetId: nextPerspective === 'true-3d'
          ? 'astra-medieval'
          : (prev.pieceSetId === 'astra-medieval' ? 'default' : prev.pieceSetId),
      }
    })
  }, [])

  const updateSettings = useCallback((partial: Partial<ThemeSettings>) => {
    setSettings((prev) => enforceAssetAvailability({ ...prev, ...partial }))
  }, [])

  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_THEME_SETTINGS)
  }, [])

  const value = useMemo(
    () => ({
      isHydrated,
      settings,
      activePreset,
      activePieceSet,
      setBoardPreset,
      setPieceSet,
      setPerspective,
      setSoundPack,
      toggleSound,
      toggleCoordinates,
      togglePerspective,
      updateSettings,
      resetToDefaults,
      isCustomizerOpen,
      setIsCustomizerOpen,
    }),
    [
      isHydrated,
      settings,
      activePreset,
      activePieceSet,
      setBoardPreset,
      setPieceSet,
      setPerspective,
      setSoundPack,
      toggleSound,
      toggleCoordinates,
      togglePerspective,
      updateSettings,
      resetToDefaults,
      isCustomizerOpen,
    ]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
