import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type AppSkin = 'gpt' | 'minimal' | 'matrix'

const SKIN_STORAGE_KEY = 'world-atlas:skin:v1'

function loadSkin(): AppSkin {
  try {
    const savedSkin = localStorage.getItem(SKIN_STORAGE_KEY)
    return savedSkin === 'minimal' || savedSkin === 'matrix' ? savedSkin : 'gpt'
  } catch {
    return 'gpt'
  }
}

// Apply the saved appearance before React paints the first frame.
if (typeof document !== 'undefined') {
  document.documentElement.dataset.skin = loadSkin()
}

type SkinContextValue = {
  skin: AppSkin
  setSkin: (skin: AppSkin) => void
}

const SkinContext = createContext<SkinContextValue | null>(null)

export function SkinProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [skin, setCurrentSkin] = useState<AppSkin>(loadSkin)

  useEffect(() => {
    document.documentElement.dataset.skin = skin
    try {
      localStorage.setItem(SKIN_STORAGE_KEY, skin)
    } catch {
      // Keep the selected appearance active until the application is closed.
    }
  }, [skin])

  const setSkin = (nextSkin: AppSkin): void => setCurrentSkin(nextSkin)

  return (
    <SkinContext.Provider value={{ skin, setSkin }}>
      {children}
    </SkinContext.Provider>
  )
}

export function useSkin(): SkinContextValue {
  const context = useContext(SkinContext)
  if (!context) throw new Error('useSkin must be used inside SkinProvider')
  return context
}
