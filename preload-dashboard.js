const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('radarHistory', {
  get: () => ipcRenderer.invoke('history:get'),
  clear: () => ipcRenderer.invoke('history:clear'),
  onUpdate: (cb) => ipcRenderer.on('history', (_e, records) => cb(records)),
});
