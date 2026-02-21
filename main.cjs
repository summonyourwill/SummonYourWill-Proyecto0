/**
 * Entry point for the Electron main process. It initializes persistence,
 * creates the application window and wires IPC messages used by the
 * renderer. The file is intentionally lightweight so game logic can live in
 * dedicated modules.
 */
require("v8-compile-cache");
const { app, BrowserWindow, ipcMain, dialog, session, globalShortcut, Tray, Menu } = require('electron');
const path = require('node:path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');

// En dev apuntamos a ./src, en build apuntamos a ./build-src
const APP_SUBDIR = app.isPackaged ? 'build-src' : 'src';
const requireFromApp = (...segments) => {
  const resolved = path.join(__dirname, APP_SUBDIR, ...segments);
  return require(resolved);
};

const { bootstrapBuiltIns, BUILTIN_DIR } = requireFromApp('Music', 'bootstrapLibrary.cjs');
const { saveGame, loadGame, deleteSave, resetToPartida0 } = requireFromApp('core', 'saveManager.cjs');
const { importOtherGamesGold } = requireFromApp('system', 'otherGamesIntegration.cjs');


// Initialize electron-store in the main process so renderer requests succeed.
let electronStore;
(async () => {
  try {
    const Store = (await import('electron-store')).default;
    electronStore = new Store({ name: 'game-data' });
  } catch (err) {
    console.error('Failed to load electron-store:', err);
  }
})();
const preloadPath = path.join(__dirname, 'preload.cjs');

const MUSIC_DIR = path.join(app.getPath('music'), 'SummonYourWillMusic');
const INDEX_PATH = path.join(MUSIC_DIR, 'music_index.json');

// Variables globales para el sistema de cierre de emergencia
let mainWindow, tray, FORCE_QUITTING = false;

/**
 * Función robusta para cerrar la aplicación de emergencia
 * @param {number} code - Código de salida
 */
function reallyQuit(code = 0) {
  try { FORCE_QUITTING = true; } catch {}
  try {
    // Cierra y destruye todas las ventanas
    for (const w of BrowserWindow.getAllWindows()) {
      try { w.destroy(); } catch {}
    }
    app.quit(); // cierre "limpio"
    // Si algo queda colgado, salimos de todos modos
    setTimeout(() => { try { app.exit(code); } catch {} }, 2000);
  } catch {
    try { app.exit(code); } catch {}
  }
}

function fileUri(p){
  return encodeURI('file://' + p.replace(/\\/g,'/'));
}

async function readIndex(){
  try {
    const data = await fsp.readFile(INDEX_PATH, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeIndex(data){
  await fsp.writeFile(INDEX_PATH, JSON.stringify(data, null, 2));
}

function resolveTrackPath(track){
  return track.builtIn ? path.join(BUILTIN_DIR, track.filename) : path.join(MUSIC_DIR, track.filename);
}

async function visibleIndex(){
  const idx = await readIndex();
  const visible = [];
  for (const t of idx) {
    try {
      await fsp.access(resolveTrackPath(t));
      visible.push({ ...t, absPath: fileUri(path.resolve(resolveTrackPath(t))) });
    } catch {}
  }
  if (visible.length !== idx.length) {
    await writeIndex(visible);
  }
  return visible.sort((a,b) => a.title.localeCompare(b.title));
}

const defaultData = { energia: 100, heroes: [], fotos: [] };
let currentGameState = defaultData;
let skipSaveOnQuit = false;
let isQuitting = false;

/**
 * Create the main application window and set up listeners that forward
 * visibility changes to the renderer and handle save requests.
 *
 * @returns {void}
 */
function createWindow() {
  const isCell = process.env.APP_MODE === 'cell';
  const isDev = !app.isPackaged;

  if (app.isPackaged) {
    const filter = { urls: ['file://*/*'] };
    session.defaultSession.webRequest.onBeforeRequest(filter, (details, cb) => {
      const url = details.url || '';
      // Asegurar que SOLO script.js tope se sirva desde build-src (no toca utils/perf.js)
      if (/(^|\/)script\.js(\?|$)/i.test(url) && !/\/build-src\//i.test(url)) {
        const redirectURL = url.replace(/script\.js/i, 'build-src/script.js');
        return cb({ redirectURL });
      }
      // Mapear cualquier referencia a "src/" al layout real de build (flatten)
      if (/\/build-src\/src\//i.test(url)) {
        const redirectURL = url.replace(/\/build-src\/src\//gi, '/build-src/');
        return cb({ redirectURL });
      }
      if (/\/src\//i.test(url)) {
        const redirectURL = url.replace(/\/src\//gi, '/build-src/');
        return cb({ redirectURL });
      }
      return cb({ cancel: false });
    });
  }
  
  // Leer configuración de DevTools en producción
  let enableDevToolsInProd = false;
  try {
    const devToolsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'devtoolsenprod.json'), 'utf8'));
    enableDevToolsInProd = devToolsConfig.enableDevToolsInProduction || false;
    console.log(`[DEVTOOLS] Configuración cargada: enableDevToolsInProduction = ${enableDevToolsInProd}`);
  } catch (err) {
    console.warn('[DEVTOOLS] No se pudo cargar devtoolsenprod.json, usando configuración por defecto (false)');
  }
  
  // Determinar si las DevTools deben estar habilitadas
  const shouldEnableDevTools = isDev || enableDevToolsInProd;
  
  const win = new BrowserWindow({
    width: isCell ? 480 : 1600,
    height: isCell ? 800 : 800,
    icon: path.join(__dirname, 'assets', 'favicon_16x16.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
      devTools: shouldEnableDevTools,
      spellcheck: false,
      backgroundThrottling: true,
    },
  });
  
  // Asignar la ventana principal a la variable global
  mainWindow = win;
  
  // Solo cerrar DevTools automáticamente si están deshabilitadas en producción
  if (!shouldEnableDevTools) {
    win.webContents.on('devtools-opened', () => {
      console.log('[DEVTOOLS] DevTools abiertas pero están deshabilitadas, cerrando...');
      win.webContents.closeDevTools();
    });
  }

  function sendVisibility(hidden, reason) {
    win.webContents.send('app-visibility', { hidden, reason });
  }

  win.on('minimize', () => sendVisibility(true, 'minimize'));
  win.on('restore', () => sendVisibility(false, 'restore'));
  win.on('blur', () => sendVisibility(true, 'blur'));
  win.on('focus', () => sendVisibility(false, 'focus'));

  // Manejo robusto del cierre de ventana
  win.on('close', (e) => {
    // Si no estamos forzando el cierre y no es un cierre aprobado, prevenir
    if (!FORCE_QUITTING && !win.forceClose) {
      e.preventDefault();
      win.webContents.send('request-close');
    }
  });

  // Manejo de "no responde"
  win.on('unresponsive', async () => {
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Reiniciar ventana', 'Forzar salida'],
      defaultId: 0, cancelId: 1,
      message: 'La ventana no responde.',
      detail: 'Puedes intentar recargar la UI o salir por completo.'
    });
    if (response === 0) win.reload();
    else reallyQuit(1);
  });

  // Si el renderer/criatura hija se cae, ofrece salir
  win.webContents.on('render-process-gone', (_e, details) => {
    dialog.showMessageBoxSync({
      type: 'error',
      message: 'El proceso de la UI se cerró.',
      detail: `Motivo: ${details.reason}. Cerrando la aplicación…`
    });
    reallyQuit(1);
  });

  win.webContents.on('child-process-gone', (_e, details) => {
    dialog.showMessageBoxSync({
      type: 'error',
      message: 'Un subproceso de la UI se cerró.',
      detail: `Tipo: ${details.type}, Motivo: ${details.reason}. Cerrando la aplicación…`
    });
    reallyQuit(1);
  });

  if (!isCell) {
    win.maximize();
  }

  const index = isCell
    ? path.join(__dirname, 'Cellphone', 'Cellphone.html')
    : path.join(
        __dirname,
        app.isPackaged ? 'build-src' : '.',
        'index.html'
      );
  win.loadFile(index);

  ipcMain.handle('show-save-dialog', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Save Game',
      defaultPath: 'summonyourwill_save.json',
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });
    return canceled ? null : filePath;
  });

  ipcMain.handle('save-file', async (_event, { filePath, data }) => {
    if (filePath) {
      await fs.promises.writeFile(filePath, JSON.stringify(data ?? {}));
    }
  });

  ipcMain.on('close-approved', () => {
    win.forceClose = true;
    win.close();
  });

  // Manejador IPC para cierre de emergencia
  ipcMain.handle('app:quit', () => { 
    reallyQuit(0); 
  });
}

ipcMain.handle('get-game-state', () => currentGameState);
ipcMain.on('set-game-state', (_event, data) => {
  currentGameState = data;
});
ipcMain.on('skip-save-on-quit', () => { skipSaveOnQuit = true; });

// Handler para resetear a partida0.json
ipcMain.handle('reset-to-partida0', async () => {
  try {
    const success = await resetToPartida0();
    if (success) {
      // Recargar el estado desde el save.json recién creado
      currentGameState = await loadGame({});
    }
    return success;
  } catch (error) {
    console.error('Error al resetear a partida0:', error);
    return false;
  }
});

ipcMain.on('electron-store-get', (event, key) => {
  event.returnValue = electronStore?.get(key);
});
ipcMain.on('electron-store-set', (event, key, value) => {
  electronStore?.set(key, value);
  event.returnValue = null;
});
ipcMain.on('electron-store-delete', (event, key) => {
  electronStore?.delete(key);
  event.returnValue = null;
});

ipcMain.handle('export-all-images', async (_event, items = []) => {
  const picturesDir = app.getPath('pictures');
  const baseDir = path.join(picturesDir, 'SummonYourWillImages');
  for (const item of items) {
    try {
      const destDir = path.join(baseDir, item.subdir);
      await fsp.mkdir(destDir, { recursive: true });
      const destPath = path.join(destDir, item.filename);
      const src = item.src || '';
      let buf;
      if (src.startsWith('data:')) {
        const base64 = src.split(',')[1] || '';
        buf = Buffer.from(base64, 'base64');
      } else if (/^https?:/i.test(src)) {
        const res = await fetch(src);
        const arr = await res.arrayBuffer();
        buf = Buffer.from(arr);
      } else {
        let filePath = src;
        if (src.startsWith('file://')) {
          filePath = new URL(src).pathname;
        } else if (!path.isAbsolute(src)) {
          filePath = path.join(app.getAppPath(), src);
        }
        buf = await fsp.readFile(filePath);
      }
      await fsp.writeFile(destPath, buf);
    } catch (err) {
      console.warn('Failed to export image', item.filename, err.message);
    }
  }
  return baseDir;
});

// Handler para seleccionar imágenes del diario
ipcMain.handle('diary:select-images', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
    ],
    properties: ['openFile']
  });
  return canceled ? null : filePaths[0];
});

// Handler para guardar imagen en el directorio del diario
ipcMain.handle('diary:save-image', async (_event, { sourceFile, date, imageIndex }) => {
  const picturesDir = app.getPath('pictures');
  const diaryDir = path.join(picturesDir, 'SummonYourWillImages', 'Diary');
  await fsp.mkdir(diaryDir, { recursive: true });
  
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD format
  const day = dateStr.slice(6, 8);
  const month = dateStr.slice(4, 6);  
  const year = dateStr.slice(0, 4);
  const formattedDate = `${day}${month}${year}`;
  
  const ext = path.extname(sourceFile);
  const fileName = `${formattedDate}_${imageIndex}${ext}`;
  const destPath = path.join(diaryDir, fileName);
  
  await fsp.copyFile(sourceFile, destPath);
  return destPath;
});

// Handler para eliminar imagen del diario
ipcMain.handle('diary:delete-image', async (_event, imagePath) => {
  try {
    await fsp.unlink(imagePath);
    return true;
  } catch (err) {
    console.warn('Failed to delete diary image:', err);
    return false;
  }
});

ipcMain.handle('music:list', async () => {
  return visibleIndex();
});

ipcMain.handle('music:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'Audio', extensions: ['mp3'] }],
    properties: ['openFile', 'multiSelections']
  });
  if (canceled) return [];
  let idx = await readIndex();
  const added = [];
  for (const file of filePaths) {
    try {
      const stat = await fsp.stat(file);
      if (path.extname(file).toLowerCase() !== '.mp3' || stat.size > 100 * 1024 * 1024) continue;

      const original = path.basename(file);
      let destName = original;
      let counter = 1;
      while (true) {
        try {
          await fsp.access(path.join(MUSIC_DIR, destName));
          const parsed = path.parse(original);
          destName = `${parsed.name} (${counter})${parsed.ext}`;
          counter++;
        } catch {
          break;
        }
      }

      const destPath = path.join(MUSIC_DIR, destName);
      await fsp.copyFile(file, destPath);
      const track = {
        id: crypto.randomUUID(),
        title: path.parse(destName).name,
        filename: destName,
        absPath: fileUri(destPath),
        durationSec: 0,
        addedAt: new Date().toISOString(),
        builtIn: false
      };
      idx.push(track);
      added.push(track);
    } catch {}
  }
  await writeIndex(idx);
  return added;
});

ipcMain.handle('music:delete', async (_event, { id }) => {
  let idx = await readIndex();
  const track = idx.find(t => t.id === id);
  if (!track) return visibleIndex();
  if (track.builtIn) throw new Error('Built-in tracks cannot be deleted.');
  const p = resolveTrackPath(track);
  await fsp.unlink(p).catch(() => {});
  idx = idx.filter(t => t.id !== id);
  await writeIndex(idx);
  return visibleIndex();
});

ipcMain.handle('music:updateDuration', async (_event, { id, durationSec }) => {
  const idx = await readIndex();
  const track = idx.find(t => t.id === id);
  if (track) {
    track.durationSec = durationSec;
    await writeIndex(idx);
  }
});

ipcMain.handle('music:bootstrapBuiltIns', async () => {
  const boot = bootstrapBuiltIns(await readIndex());
  if (boot.changed) await writeIndex(boot.index);
  return visibleIndex();
});

ipcMain.handle('music:exportSnapshot', async () => {
  return visibleIndex();
});

ipcMain.handle('read-html-file', async (_event, filename) => {
  try {
    const filePath = path.join(
      __dirname,
      app.isPackaged ? 'build-src' : '.',
      filename
    );
    const content = await fsp.readFile(filePath, 'utf8');
    return content;
  } catch (error) {
    console.error(`Error reading HTML file ${filename}:`, error);
    return null;
  }
});

ipcMain.handle('music:importSnapshot', async (_event, snapshot) => {
  const incoming = Array.isArray(snapshot) ? snapshot : [];
  const idx = [];
  let missing = 0;
  for (const t of incoming) {
    const p = resolveTrackPath(t);
    try {
      await fsp.access(p);
      t.absPath = fileUri(p);
      idx.push(t);
    } catch {
      missing++;
    }
  }
  const boot = bootstrapBuiltIns(idx);
  await writeIndex(boot.index);
  return { visibleCount: boot.index.length, missingCount: missing };
});
app.on('before-quit', async (event) => {
  if (!skipSaveOnQuit && !isQuitting) {
    event.preventDefault();
    isQuitting = true;
    try {
      await saveGame(currentGameState);
    } catch (err) {
      console.error('[SAVE] Failed to save on quit:', err);
    }
    
    app.quit();
  }
});

app.whenReady().then(async () => {
  // Verificación de archivos críticos en producción
  if (app.isPackaged) {
    const appPath = app.getAppPath();
    const criticalFiles = [
      path.join(appPath, 'build-src', 'script.js'),
      path.join(appPath, 'build-src', 'style.css'),
      path.join(appPath, 'build-src', 'renderer', 'styles', 'scrollFix.css'),
      path.join(appPath, 'build-src', 'index.html')
    ];
    
    console.log('[PROD CHECK] appPath:', appPath);
    for (const file of criticalFiles) {
      const exists = fs.existsSync(file);
      console.log(`[PROD CHECK] ${path.basename(file)} exists?`, exists, file);
      if (!exists) {
        console.error(`❌ CRITICAL: ${path.basename(file)} is missing!`);
      }
    }
  }
  
  await fsp.mkdir(MUSIC_DIR, { recursive: true });
  try {
    await fsp.access(INDEX_PATH);
  } catch {
    await writeIndex([]);
  }
  const boot = bootstrapBuiltIns(await readIndex());
  if (boot.changed) await writeIndex(boot.index);

  try {
    const res = await importOtherGamesGold();
    const msg = res.imported > 0
      ? `[OtherGames] Imported ${res.imported} gold into ${res.moneyField}`
      : `[OtherGames] ${res.message}`;
    console.log(msg);
  } catch (err) {
    console.warn('[OtherGames] import failed:', err);
  }

  currentGameState = await loadGame(defaultData);

  createWindow();

  // Atajo global de emergencia: Ctrl+Shift+Q
  try {
    globalShortcut.register('Control+Shift+Q', () => reallyQuit(0));
    console.log('[EMERGENCY] Atajo global registrado: Ctrl+Shift+Q');
  } catch (err) {
    console.warn('[EMERGENCY] No se pudo registrar el atajo global:', err.message);
  }

  // Icono de bandeja con opción de salida forzada
  try {
    const trayIcon = app.isPackaged
      ? path.join(process.resourcesPath, 'assets', 'favicon.ico')
      : path.join(__dirname, 'assets', 'favicon.ico');
    
    tray = new Tray(trayIcon);
    const menu = Menu.buildFromTemplate([
      { label: 'Mostrar', click: () => { 
        if (mainWindow?.isMinimized()) mainWindow.restore(); 
        mainWindow?.show(); 
      }},
      { type: 'separator' },
      { label: 'Salir (Forzar)', click: () => reallyQuit(0) }
    ]);
    tray.setToolTip('SummonYourWill');
    tray.setContextMenu(menu);
    console.log('[EMERGENCY] Icono de bandeja configurado');
  } catch (err) {
    console.warn('[EMERGENCY] No se pudo configurar el icono de bandeja:', err.message);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

ipcMain.on('reset-everything', async () => {
  skipSaveOnQuit = true;
  await session.defaultSession.clearStorageData({
    storages: ['localstorage', 'cookies', 'indexeddb', 'serviceworkers', 'caches'],
    quotas: ['temporary', 'persistent', 'syncable']
  });
  try {
    electronStore?.clear();
  } catch (err) {
    console.error('Failed to clear electron-store:', err);
  }
  
  // En producción, copiar partida0.json a save.json antes de reiniciar
  // Así al abrir de nuevo la app, cargará los datos de partida0
  await resetToPartida0();
  
  app.relaunch();
  app.exit(0);
});

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => { FORCE_QUITTING = true; });
  app.on('will-quit', () => {
    try { globalShortcut.unregisterAll(); } catch {}
    try { if (tray) tray.destroy(); } catch {}
  });
