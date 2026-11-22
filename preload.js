const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('radar', {
  onState: (cb) => ipcRenderer.on('state', (_e, s) => cb(s)),
  onFlash: (cb) => ipcRenderer.on('flash', () => cb()),
  resize: (h) => ipcRenderer.send('resize', h),
  focus: (key) => ipcRenderer.send('focus-session', key),
  dismiss: (key) => ipcRenderer.send('dismiss', key),
  toggleCollapsed: () => ipcRenderer.send('toggle-collapsed'),
  menu: () => ipcRenderer.send('menu'),
});
