/**
 * KY-Poni - Native Desktop Application (Electron Main Process)
 * Boots the local broadcaster server and displays the native Studio Window.
 * Features Single-Instance Locking and EADDRINUSE Port Recovery.
 */

const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const http = require('http');
const { server, youtubeIngest, themeManager, PORT } = require('./server');

// Enforce single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[KY-Poni Desktop] Another instance is already running. Focusing existing window and exiting.');
  app.quit();
}

let mainWindow = null;
let serverInstance = null;

function checkPortInUse(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/status`, { timeout: 1000 }, (res) => {
      resolve(true); // Existing KY-Poni or HTTP server is listening
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function startLocalServer() {
  const inUse = await checkPortInUse(PORT);
  if (inUse) {
    console.log(`[KY-Poni Desktop] Existing server detected on port ${PORT}. Reusing active instance.`);
    return;
  }

  return new Promise((resolve) => {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[KY-Poni Desktop] Port ${PORT} was claimed during startup. Proceeding with existing server.`);
        resolve();
      } else {
        console.error('[KY-Poni Desktop] Server error:', err);
        resolve();
      }
    });

    serverInstance = server.listen(PORT, '127.0.0.1', () => {
      console.log(`[KY-Poni Desktop] Local broadcaster active on port ${PORT}`);
      resolve();
    });
  });
}

async function createWindow() {
  await startLocalServer();

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1040,
    minHeight: 720,
    title: 'KY-Poni - Livestream Chat Overlay Studio',
    icon: path.join(__dirname, 'public', 'assets', 'icon.png'),
    backgroundColor: '#0B0E14',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external web links in user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.loadURL(`http://localhost:${PORT}/`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (youtubeIngest) {
    try { youtubeIngest.disconnect(); } catch (e) {}
  }
  if (serverInstance) {
    try { serverInstance.close(); } catch (e) {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Suppress unhandled crash popups in production
process.on('uncaughtException', (err) => {
  console.error('[KY-Poni Desktop] Uncaught exception:', err);
});
