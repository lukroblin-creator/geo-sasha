import { contextBridge, ipcRenderer } from 'electron'

const api = {
  readMapTexture: (
    assetKey:
      | 'earth-day-mercator'
      | 'earth-night-mercator'
      | 'earth-clouds-mercator'
      | 'earth-topography-mercator'
  ) => ipcRenderer.invoke('read-map-texture', assetKey) as Promise<Uint8Array>
}

contextBridge.exposeInMainWorld('electron', {
  process: {
    versions: {
      electron: process.versions.electron ?? '',
      chrome: process.versions.chrome ?? '',
      node: process.versions.node
    }
  }
})
contextBridge.exposeInMainWorld('api', api)
