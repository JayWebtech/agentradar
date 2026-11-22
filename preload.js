const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('radar', {
  onState: (cb) => ipcRenderer.on('state', (_e, s) => cb(s)),
  onFlash: (cb) => ipcRenderer.on('flash', () => cb()),
  onSound: (cb) => ipcRenderer.on('sound', (_e, kind) => cb(kind)),
  openDashboard: () => ipcRenderer.send('open-dashboard'),
  resize: (h) => ipcRenderer.send('resize', h),
  focus: (key) => ipcRenderer.send('focus-session', key),
  decide: (key, decision) => ipcRenderer.send('decide', key, decision),
  dismiss:(key) => ipcRenderer.send('dismiss', key),
  toggleCollapsed: () => ipcRenderer.send('toggle-collapsed'),
  menu: () => ipcRenderer.send('menu'),
});
