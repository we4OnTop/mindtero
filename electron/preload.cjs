const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('mindtero', {
  isDesktop: true,
  autoSave: (json) => ipcRenderer.invoke('mindtero:autoSave', json),
  autoSaveSync: (json) => ipcRenderer.sendSync('mindtero:autoSaveSync', json),
  loadAutosave: () => ipcRenderer.invoke('mindtero:loadAutosave'),
  autosavePath: () => ipcRenderer.invoke('mindtero:autosavePath'),
  revealAutosave: () => ipcRenderer.invoke('mindtero:revealAutosave'),
  storageInfo: () => ipcRenderer.invoke('mindtero:storageInfo'),
  chooseProjectDir: () => ipcRenderer.invoke('mindtero:chooseProjectDir'),
  resetProjectDir: () => ipcRenderer.invoke('mindtero:resetProjectDir'),
  chooseBoardFile: (boardId, boardName) =>
    ipcRenderer.invoke('mindtero:chooseBoardFile', boardId, boardName),
  clearBoardFile: (boardId) => ipcRenderer.invoke('mindtero:clearBoardFile', boardId),
  saveBoardFile: (boardId, json) => ipcRenderer.invoke('mindtero:saveBoardFile', boardId, json),
  loadBoardFiles: () => ipcRenderer.invoke('mindtero:loadBoardFiles'),
  revealBoardFile: (boardId) => ipcRenderer.invoke('mindtero:revealBoardFile', boardId),
  openExternal: (url) => ipcRenderer.invoke('mindtero:openExternal', url),
  rescueBoards: () => ipcRenderer.invoke('mindtero:rescueBoards'),
  markRescueDone: () => ipcRenderer.invoke('mindtero:markRescueDone'),
})
