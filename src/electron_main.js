/**
 * KY-Poni - Native Desktop Application (Electron Main Process)
 * Boots the local broadcaster server and displays the native Studio Window.
 */

const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { server, youtubeIngest, themeManager, PORT } = require('./server');

let mainWindow = null;
let serverInstance = null;

function startLocalServer() {
  return new Promise((resolve) => {
    if (!server.listening) {
      serverInstance = server.listen(PORT, '127.0.0.1', () => {
        console.log(`[KY-Poni Desktop] Local broadcaster active on port ${PORT}`);
        resolve();
      });
    } else {
      resolve();
    }
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
