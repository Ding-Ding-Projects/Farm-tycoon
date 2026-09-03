// Electron main process — wraps the same static files the browser runs, and adds the two things
// only the desktop build has: a frameless window with our own Material title bar, and the
// Squirrel.Windows auto-updater. Both are desktop-only; the browser build never sees them.
const { app, BrowserWindow, ipcMain, autoUpdater, shell } = require('electron');
const path = require('path');

const ICON_PATH = path.join(__dirname, '..', 'build', 'icon.ico');

// Squirrel fires the app with these on install/update/uninstall. electron-builder's stub creates
// the shortcuts itself, so all we owe it is a quick, quiet exit — staying alive here flashes a
// window during every install.
if (process.platform === 'win32' && process.argv.some((a) => a.startsWith('--squirrel-'))) {
  app.quit();
}

// One stable feed. GitHub redirects /releases/latest/download/<name> to the newest release's
// asset, so RELEASES and the .nupkg files it names both resolve without pinning a tag.
const FEED_URL = 'https://github.com/Ding-Ding-Projects/Farm-tycoon/releases/latest/download';

let win = null;

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'Farm Tycoon',
    backgroundColor: '#aee3ff',
    frame: false,
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // The renderer paints its own maximise/restore glyph, so it needs to hear the real state
  // rather than assume it — a window snapped by the OS never went through our button.
  const pushState = () => send('window:state', { maximized: win.isMaximized() });
  win.on('maximize', pushState);
  win.on('unmaximize', pushState);
  win.loadFile(path.join(__dirname, '..', 'index.html'));
}

ipcMain.on('window:minimize', () => win && win.minimize());
ipcMain.on('window:toggle-maximize', () => {
  if (!win) return;
  if (win.isMaximized()) win.unmaximize(); else win.maximize();
});
ipcMain.on('window:close', () => win && win.close());
ipcMain.handle('window:is-maximized', () => !!win && win.isMaximized());
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.on('app:open-release-notes', () => {
  shell.openExternal('https://github.com/Ding-Ding-Projects/Farm-tycoon/releases/latest');
});

// --- Updates -------------------------------------------------------------------------------
// Squirrel.Windows only. The artifacts are deliberately unsigned (code signing is out of scope
// for this project), so the renderer's banner says so rather than implying a verified publisher.
let updateReady = false;

function checkForUpdates() {
  if (updateReady) return;
  try { autoUpdater.checkForUpdates(); }
  catch (err) { send('update:state', { state: 'error', message: String(err && err.message || err) }); }
}

function initUpdater() {
  // Only a packaged Squirrel install has an Update.exe to talk to; a dev run has none, and
  // calling setFeedURL there throws.
  if (process.platform !== 'win32' || !app.isPackaged) {
    send('update:state', { state: 'unsupported' });
    return;
  }
  try {
    autoUpdater.setFeedURL({ url: FEED_URL });
  } catch (err) {
    send('update:state', { state: 'error', message: String(err && err.message || err) });
    return;
  }
  autoUpdater.on('checking-for-update', () => send('update:state', { state: 'checking' }));
  autoUpdater.on('update-available', () => send('update:state', { state: 'downloading' }));
  autoUpdater.on('update-not-available', () => send('update:state', { state: 'current' }));
  autoUpdater.on('error', (err) => send('update:state', { state: 'error', message: String(err && err.message || err) }));
  autoUpdater.on('update-downloaded', (_e, _notes, name) => {
    updateReady = true;
    send('update:state', { state: 'ready', version: name || '' });
  });
  checkForUpdates();
  // Bounded background schedule — every six hours, not a tight poll.
  setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
}

ipcMain.on('update:check', () => { initUpdaterOnce(); checkForUpdates(); });
ipcMain.on('update:restart', () => { if (updateReady) autoUpdater.quitAndInstall(); });

let updaterStarted = false;
function initUpdaterOnce() {
  if (updaterStarted) return;
  updaterStarted = true;
  initUpdater();
}

app.whenReady().then(() => {
  createWindow();
  // Give the renderer a moment to attach its listener before the first verdict lands.
  win.webContents.once('did-finish-load', () => setTimeout(initUpdaterOnce, 3000));
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
