import { app, BrowserWindow, ipcMain, shell, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initDatabase, getDb } from './db/database.js';
import { registerIpcHandlers } from './ipc/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, '..');

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

let win: BrowserWindow | null = null;

function pdfDirectory(): string {
  return path.join(app.getPath('userData'), 'pdfs');
}

function createWindow() {
  let iconPath: string | undefined;
  try {
    const row = getDb().prepare('SELECT icon_path, logo_path FROM configuration WHERE id = 1').get() as { icon_path: string | null; logo_path: string | null } | undefined;
    const preferred = row?.icon_path && fs.existsSync(row.icon_path) ? row.icon_path : null;
    const fallback = row?.logo_path && fs.existsSync(row.logo_path) ? row.logo_path : null;
    iconPath = preferred ?? fallback ?? undefined;
  } catch { /* ignore */ }

  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: 'CRM APM35',
    icon: iconPath ? nativeImage.createFromPath(iconPath) : undefined,
    backgroundColor: '#ffffff',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 16 } : undefined,
    webPreferences: {
      preload: path.join(MAIN_DIST, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Block any attempt to open external / arbitrary URLs in a new window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Allow opening genuine external links in the default browser, but never
    // inside this Electron window.
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Block in-window navigation to anything other than our own Vite dev server
  // or the packaged file:// URL.
  win.webContents.on('will-navigate', (event, url) => {
    if (VITE_DEV_SERVER_URL && url.startsWith(VITE_DEV_SERVER_URL)) return;
    if (url.startsWith('file://')) return;
    event.preventDefault();
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
}

app.whenReady().then(() => {
  initDatabase();
  registerIpcHandlers(ipcMain);

  ipcMain.handle('shell:open-file', async (_evt, filePath: string) => {
    if (typeof filePath !== 'string' || filePath.length === 0) {
      throw new Error('Chemin invalide');
    }
    const resolved = path.resolve(filePath);
    const allowedDir = pdfDirectory();
    const normalizedAllowed = allowedDir.endsWith(path.sep) ? allowedDir : allowedDir + path.sep;
    if (!resolved.startsWith(normalizedAllowed)) {
      throw new Error('Chemin non autorisé');
    }
    if (path.extname(resolved).toLowerCase() !== '.pdf') {
      throw new Error('Seuls les fichiers PDF peuvent être ouverts');
    }
    const error = await shell.openPath(resolved);
    if (error) throw new Error(error);
    return { ok: true };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
  win = null;
});
