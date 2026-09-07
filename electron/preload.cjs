const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('mindtero', {
  isDesktop: true,
  autoSave: (json) => ipcRenderer.invoke('mindtero:autoSave', json),
  loadAutosave: () => ipcRenderer.invoke('mindtero:loadAutosave'),
  autosavePath: () => ipcRenderer.invoke('mindtero:autosavePath'),
  revealAutosave: () => ipcRenderer.invoke('mindtero:revealAutosave'),
})
