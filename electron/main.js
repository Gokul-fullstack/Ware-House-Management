// electron/main.js — Electron main process
const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const { initDatabase, saveDatabase } = require('./database/schema');
const { seedDatabase } = require('./database/seed');
const { createServer } = require('./server');

let mainWindow = null;
let tray = null;
const isDev = !app.isPackaged;
const PORT = 3456;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0a0e1a',
    title: 'Arun Traders — Billing & Inventory',
    icon: app.isPackaged 
      ? path.join(__dirname, '../dist/icon.png')
      : path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });
}

async function startApp() {
  // Initialize database
  const dbPath = isDev
    ? path.join(__dirname, '..', 'data', 'aruntraders.sqlite')
    : path.join(app.getPath('userData'), 'aruntraders.sqlite');

  console.log(`[Database] Path: ${dbPath}`);
  const db = await initDatabase(dbPath);
  seedDatabase(db, saveDatabase);

  // Start Express API server
  const { restoreDatabase } = require('./database/schema');
  const expressApp = createServer(db, saveDatabase, dbPath, restoreDatabase);
  expressApp.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Arun Traders API running on http://0.0.0.0:${PORT}`);
  });

  // Auto-save database every 30 seconds
  setInterval(() => saveDatabase(), 30000);

  await createWindow();
}

// IPC handlers
ipcMain.handle('print', async (event, type, data) => {
  try {
    let width = 794;
    let height = 1123;
    let htmlModule;
    let html;

    if (type === 'thermal') {
      width = 302;
      height = 800;
      htmlModule = require('./print/thermal');
      html = htmlModule.generateThermalHTML(data.invoice, data.company);
    } else if (type === 'a5') {
      width = 595;
      height = 842;
      htmlModule = require('./print/a5-invoice');
      html = htmlModule.generateA5InvoiceHTML(data.invoice, data.company);
    } else {
      htmlModule = require('./print/a4-invoice');
      html = htmlModule.generateA4InvoiceHTML(data.invoice, data.company);
    }

    const win = new BrowserWindow({ show: false, width, height });
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await new Promise(resolve => setTimeout(resolve, 500));
    await win.webContents.print({ silent: false, printBackground: true, margins: { marginType: 'none' } });
    win.close();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-printers', () => mainWindow?.webContents.getPrintersAsync() || []);
ipcMain.handle('get-app-version', () => app.getVersion());

// App lifecycle
app.whenReady().then(startApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    saveDatabase();
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow) mainWindow.show();
  else createWindow();
});

app.on('before-quit', () => {
  saveDatabase();
  if (mainWindow) {
    mainWindow.removeAllListeners('close');
    mainWindow.close();
  }
});
