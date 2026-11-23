import { useEffect, useRef, useState } from 'react'

import type { MapTextureAssetKey } from './worldMapOpacityMasks'
import { createPolarExtendedTextureUrl } from './worldMapPolarTexture'

type ExtendedTexture = {
  sourceUrl: string
  url: string
}

export function useWorldMapGlobeTexture(
  sourceUrl: string | null,
  assetKey: MapTextureAssetKey,
  active: boolean
): string | null {
  const [extendedTexture, setExtendedTexture] = useState<ExtendedTexture | null>(null)
  const generatedUrlsRef = useRef(new Set<string>())

  useEffect(() => {
    if (!active || !sourceUrl) {
      setExtendedTexture((current) => {
        if (current) {
          URL.revokeObjectURL(current.url)
          generatedUrlsRef.current.delete(current.url)
        }
        return null
      })
      return
    }

    let cancelled = false
    void createPolarExtendedTextureUrl(sourceUrl, assetKey)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        generatedUrlsRef.current.add(url)
        setExtendedTexture((current) => {
          if (current && current.url !== url) {
            URL.revokeObjectURL(current.url)
            generatedUrlsRef.current.delete(current.url)
          }
          return { sourceUrl, url }
        })
      })
      .catch((error) => {
        if (!cancelled) console.warn('Impossible de prolonger la texture vers les pôles.', error)
      })

    return () => {
      cancelled = true
    }
  }, [active, assetKey, sourceUrl])

  useEffect(
    () => () => {
      for (const url of generatedUrlsRef.current) URL.revokeObjectURL(url)
      generatedUrlsRef.current.clear()
    },
    []
  )

  return extendedTexture?.sourceUrl === sourceUrl ? extendedTexture.url : null
}
