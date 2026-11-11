/**
 * Astra Atlas Loader & Bounded LRU Cache Manager
 * Enforces the 48 MiB decoded memory budget specified in docs/astra/PRODUCTION.md.
 */

import type { AtlasManifest } from './types.ts'

export interface LoadedAtlas {
  manifest: AtlasManifest
  imageBitmap?: ImageBitmap
  imageElement?: HTMLImageElement
  url: string
  lastUsed: number
  decodedBytes: number
}

const MAX_DECODED_BYTES = 48 * 1024 * 1024 // 48 MiB hard budget

class AtlasLoaderCache {
  private cache = new Map<string, LoadedAtlas>()
  private currentBytes = 0

  /**
   * Loads an atlas clip and its manifest from the versioned path.
   * If not available or fails decoding, returns null for graceful fallback.
   */
  public async loadClip(
    classCode: string,
    clipName: string,
    direction: string = 'NE',
    resolution: 128 | 256 = 128,
    revision: string = 'v001'
  ): Promise<LoadedAtlas | null> {
    const basePath = `/pieces/astra/${revision}/${classCode}/${clipName}/${direction}`
    const manifestUrl = `${basePath}/clip.json`
    const cacheKey = `${basePath}_${resolution}`

    // Check LRU cache
    const existing = this.cache.get(cacheKey)
    if (existing) {
      existing.lastUsed = Date.now()
      return existing
    }

    try {
      // 1. Fetch manifest
      const res = await fetch(manifestUrl)
      if (!res.ok) {
        // Missing asset; gracefully return null
        return null
      }

      const manifest: AtlasManifest = await res.json()
      if (manifest.schemaVersion !== 1 || !manifest.image) {
        console.warn(`[AstraAtlasLoader] Invalid manifest schema for ${basePath}`)
        return null
      }

      const imageUrl = `${basePath}/${manifest.image}`

      // 2. Fetch image payload
      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) return null

      const blob = await imgRes.blob()

      // 3. Decode into ImageBitmap or fallback ImageElement
      let imageBitmap: ImageBitmap | undefined
      let imageElement: HTMLImageElement | undefined
      const decodedBytes = manifest.decodedBytes || manifest.cell * manifest.columns * 4

      // Enforce memory budget before insertion
      this.evictIfNeeded(decodedBytes)

      if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
        try {
          imageBitmap = await createImageBitmap(blob)
        } catch {
          imageBitmap = undefined
        }
      }

      if (!imageBitmap && typeof Image !== 'undefined') {
        const objectUrl = URL.createObjectURL(blob)
        const img = new Image()
        img.src = objectUrl
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
        })
        imageElement = img
      }

      const loadedAtlas: LoadedAtlas = {
        manifest,
        imageBitmap,
        imageElement,
        url: imageUrl,
        lastUsed: Date.now(),
        decodedBytes,
      }

      this.cache.set(cacheKey, loadedAtlas)
      this.currentBytes += decodedBytes

      return loadedAtlas
    } catch {
      // Network failure or missing file
      return null
    }
  }

  /**
   * Evicts least recently used clips when budget is exceeded.
   */
  private evictIfNeeded(neededBytes: number) {
    if (this.currentBytes + neededBytes <= MAX_DECODED_BYTES) return

    // Sort by lastUsed ascending
    const entries = Array.from(this.cache.entries()).sort(
      ([, a], [, b]) => a.lastUsed - b.lastUsed
    )

    for (const [key, atlas] of entries) {
      if (this.currentBytes + neededBytes <= MAX_DECODED_BYTES) break

      if (atlas.imageBitmap && typeof atlas.imageBitmap.close === 'function') {
        atlas.imageBitmap.close()
      }
      this.currentBytes -= atlas.decodedBytes
      this.cache.delete(key)
    }
  }

  /**
   * Completely disposes cache (e.g. on unmount or theme switch)
   */
  public clear() {
    for (const atlas of this.cache.values()) {
      if (atlas.imageBitmap && typeof atlas.imageBitmap.close === 'function') {
        atlas.imageBitmap.close()
      }
    }
    this.cache.clear()
    this.currentBytes = 0
  }

  public getMemoryUsage(): { residentBytes: number; clipCount: number } {
    return {
      residentBytes: this.currentBytes,
      clipCount: this.cache.size,
    }
  }
}

export const astraAtlasLoader = new AtlasLoaderCache()
