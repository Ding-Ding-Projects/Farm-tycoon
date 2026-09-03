// Preload — the only bridge. Exposes exactly the window-chrome and update actions the custom
// title bar needs, and nothing else; the game itself remains pure web tech.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('farmDesktop', {
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  version: () => ipcRenderer.invoke('app:version'),
  onWindowState: (fn) => ipcRenderer.on('window:state', (_e, s) => fn(s)),
  checkForUpdates: () => ipcRenderer.send('update:check'),
  restartToUpdate: () => ipcRenderer.send('update:restart'),
  openReleaseNotes: () => ipcRenderer.send('app:open-release-notes'),
  onUpdateState: (fn) => ipcRenderer.on('update:state', (_e, s) => fn(s)),
});
