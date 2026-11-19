declare global {
  interface Window {
    electron: {
      process: {
        versions: {
          electron: string
          chrome: string
          node: string
        }
      }
    }
    api: {
      readMapTexture: (
        assetKey:
          | 'earth-day-mercator'
          | 'earth-night-mercator'
          | 'earth-clouds-mercator'
          | 'earth-topography-mercator'
      ) => Promise<Uint8Array>
    }
  }
}

export {}
