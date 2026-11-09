# Astra Theme & Piece Integration Guide

## Overview

BlunderBot features an extensible, theme-neutral architecture designed to cleanly host custom chess models, physical materials, and animation sequences without coupling the surrounding application interface to a specific historical or fantasy era.

This document serves as the formal specification for **Astra** to integrate the ancient Indian medieval war chess army (Gaja/War Elephants, Ratha/Chariots, Ashva/Cavalry, Padati/Infantry, and Rajput Royalty).

---

## Architecture Boundaries

| Responsibility | Owner |
|---|---|
| Application Shell, Navigation, Menus, Settings, Clocks, Move List, Engine Worker, Responsive Layouts | **BlunderBot Core UI/UX** |
| 3D Piece Models, Textures, Capture Sequences, Debris/Destruction, Battlefield Effects | **Astra** |

---

## 1. Registered Presets

### Board Preset: `ancient-battlefield`
- **ID:** `ancient-battlefield`
- **Tones:** Weathered sandstone flagstones (`#C8A87D`) and scorched dark basalt tiles (`#483526`).
- **Physical Bevel:** Deep earthen border with perimeter grooves, carved stone bevels, and warm contact shadows.
- **Audio Profile:** Stone timbre procedural resonance.

### Piece Set: `astra-medieval`
- **ID:** `astra-medieval`
- **Current Mode:** Registered integration slot with automatic fallback to high-contrast vector pieces until 3D mesh assets are mounted.

---

## 2. Event Dispatching & Integration API

Astra's system communicates via `apps/frontend/src/theme/astraIntegration.ts`.

### Listening to Captures (Debris & Destruction)
```typescript
import { astraHub, AstraCaptureEvent } from '@/theme/astraIntegration'

const unsubscribe = astraHub.onCapture((event: AstraCaptureEvent) => {
  console.log(`Battlefield destruction at ${event.victimSquare}:`, event.victimPiece)
  // Trigger custom WebGL particle explosion / stone crumbling
  // Call event.onAnimationComplete() when debris finishes
})
```

### Listening to Moves (Combat Movement Arcs)
```typescript
import { astraHub } from '@/theme/astraIntegration'

astraHub.onMove((from: string, to: string, piece: string) => {
  // Trigger piece walk / charge / gallop animation
})
```

### Registering Astra's 3D Engine Provider
```typescript
import { astraHub } from '@/theme/astraIntegration'

astraHub.registerProvider({
  isLoaded: true,
  version: '1.0.0',
  supportedPieces: ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'],
  onCapture: (event) => {
    // Custom handling
  }
})
```

---

## 3. Fallback Guarantee

Whenever `astra-medieval` piece set is selected but external WebGL/GLTF assets are not mounted or device GPU is constrained, BlunderBot automatically displays the high-legibility neoclassical pieces rendered with the ancient battlefield sandstone/basalt palette so gameplay remains 100% stable, accessible, and fast.
