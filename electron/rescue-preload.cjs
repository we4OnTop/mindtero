const { contextBridge, ipcRenderer } = require('electron')

// Only used by the hidden recovery window (see rescue.cjs).
contextBridge.exposeInMainWorld('mindteroRescue', {
  done: (payload) => ipcRenderer.send('mindtero:rescueResult', payload),
})
