const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// Data storage path: %APPDATA%/FinTrack/data.json
const dataDir = path.join(app.getPath('appData'), 'FinTrack');
const dataFile = path.join(dataDir, 'data.json');

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function readData() {
  ensureDataDir();
  try {
    if (fs.existsSync(dataFile)) {
      return JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading data file:', err);
  }
  return null;
}

function writeData(data) {
  ensureDataDir();
  try {
    // Write to temp file first, then rename for atomic write (prevents corruption)
    const tmpFile = dataFile + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, dataFile);
    return true;
  } catch (err) {
    console.error('Error writing data file:', err);
    return false;
  }
}

// IPC handlers
ipcMain.handle('load-data', () => {
  return readData();
});

ipcMain.handle('save-data', (event, data) => {
  return writeData(data);
});

ipcMain.handle('get-data-path', () => {
  return dataFile;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Auto-update status sent to renderer
function sendUpdateStatus(status, info) {
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { status, info });
  }
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'PFlux',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  // Check for updates after window loads (only in packaged app)
  if (app.isPackaged) {
    mainWindow.webContents.on('did-finish-load', () => {
      autoUpdater.checkForUpdatesAndNotify();
    });
  }
}

// Auto-updater configuration
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('checking-for-update', () => {
  sendUpdateStatus('checking');
});

autoUpdater.on('update-available', (info) => {
  sendUpdateStatus('available', info.version);
});

autoUpdater.on('update-not-available', () => {
  sendUpdateStatus('up-to-date');
});

autoUpdater.on('download-progress', (progress) => {
  sendUpdateStatus('downloading', Math.round(progress.percent));
});

autoUpdater.on('update-downloaded', (info) => {
  sendUpdateStatus('ready', info.version);
});

autoUpdater.on('error', (err) => {
  sendUpdateStatus('error', err.message);
});

ipcMain.on('restart-for-update', () => {
  autoUpdater.quitAndInstall();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
