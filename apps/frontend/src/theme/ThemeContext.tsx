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
        // Validate preset and piece set exist
        const validPresetId = parsed.boardPresetId && BOARD_PRESETS[parsed.boardPresetId]
          ? parsed.boardPresetId
          : DEFAULT_THEME_SETTINGS.boardPresetId
        const validPieceSetId = parsed.pieceSetId && PIECE_SETS[parsed.pieceSetId]
          ? parsed.pieceSetId
          : DEFAULT_THEME_SETTINGS.pieceSetId

        setSettings((prev) => enforceAssetAvailability({
          ...prev,
          ...parsed,
          boardPresetId: validPresetId,
          pieceSetId: validPieceSetId,
        }))
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
      setSettings((prev) => ({ ...prev, pieceSetId: id }))
    }
  }, [])

  const setPerspective = useCallback((perspective: BoardPerspective) => {
    setSettings((prev) => ({ ...prev, perspective }))
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
    setSettings((prev) => ({
      ...prev,
      perspective: prev.perspective === 'flat-2d' ? 'elevated-2.5d' : 'flat-2d',
    }))
  }, [])

  const updateSettings = useCallback((partial: Partial<ThemeSettings>) => {
    setSettings((prev) => enforceAssetAvailability({ ...prev, ...partial }))
  }, [])

  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_THEME_SETTINGS)
  }, [])

  const value = useMemo(
    () => ({
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
