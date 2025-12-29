const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep a global reference of the window object
let mainWindow = null;
let isSessionActive = false;
let sessionConfig = null;
let lockdownInterval = null;

// Paths for saving documents
const getDocumentsPath = () => {
  const documentsDir = path.join(app.getPath('documents'), 'Focus Writer Pro');
  if (!fs.existsSync(documentsDir)) {
    fs.mkdirSync(documentsDir, { recursive: true });
  }
  return documentsDir;
};

const getDraftsPath = () => {
  const draftsDir = path.join(getDocumentsPath(), 'drafts');
  if (!fs.existsSync(draftsDir)) {
    fs.mkdirSync(draftsDir, { recursive: true });
  }
  return draftsDir;
};

const getCurrentDraftPath = () => path.join(getDocumentsPath(), 'current.txt');
const getSessionsPath = () => path.join(getDocumentsPath(), 'sessions.json');
const getSettingsPath = () => path.join(getDocumentsPath(), 'settings.json');

// Create the main window
function createWindow() {
  // Check if we're in dev mode
  const isDev = process.argv.includes('--dev');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0d0d0d',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 20 },
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Prevent closing during active session
  mainWindow.on('close', (e) => {
    if (isSessionActive) {
      e.preventDefault();
      mainWindow.webContents.send('show-exit-warning');
    }
  });

  mainWindow.on('closed', () => {
    // Clear interval to prevent memory leak
    if (lockdownInterval) {
      clearInterval(lockdownInterval);
      lockdownInterval = null;
    }
    globalShortcut.unregisterAll();
    mainWindow = null;
  });
}

// Enter lockdown mode (kiosk)
function enterLockdown() {
  if (!mainWindow) return;

  isSessionActive = true;

  // Enter kiosk mode - this blocks Cmd+Tab, Force Quit, etc on macOS
  mainWindow.setKiosk(true);

  // Additional lockdown measures
  mainWindow.setFullScreen(true);
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setClosable(false);
  mainWindow.setMinimizable(false);

  // Make visible on all workspaces to prevent desktop switching
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Hide dock on macOS
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  // Disable the menu
  mainWindow.setMenuBarVisibility(false);

  // Register global shortcuts to intercept common escape attempts
  try {
    // Block Cmd+Tab (app switcher)
    globalShortcut.register('CommandOrControl+Tab', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus();
      }
    });

    // Block Cmd+` (window switcher within app)
    globalShortcut.register('CommandOrControl+`', () => {});

    // Block Cmd+Q (quit)
    globalShortcut.register('CommandOrControl+Q', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('show-exit-warning');
      }
    });

    // Block Cmd+W (close window)
    globalShortcut.register('CommandOrControl+W', () => {});

    // Block Cmd+H (hide)
    globalShortcut.register('CommandOrControl+H', () => {});

    // Block Cmd+M (minimize)
    globalShortcut.register('CommandOrControl+M', () => {});
  } catch (e) {
    console.log('Could not register some global shortcuts:', e.message);
  }

  // Periodically ensure focus stays on our window
  lockdownInterval = setInterval(() => {
    if (isSessionActive && mainWindow && !mainWindow.isFocused()) {
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  }, 500);

  console.log('Lockdown mode engaged');
}

// Exit lockdown mode
function exitLockdown() {
  if (!mainWindow) return;

  isSessionActive = false;

  // Clear the focus enforcement interval
  if (lockdownInterval) {
    clearInterval(lockdownInterval);
    lockdownInterval = null;
  }

  // Unregister all global shortcuts
  globalShortcut.unregisterAll();

  // Exit kiosk mode
  mainWindow.setKiosk(false);
  mainWindow.setFullScreen(false);
  mainWindow.setAlwaysOnTop(false);
  mainWindow.setClosable(true);
  mainWindow.setMinimizable(true);
  mainWindow.setVisibleOnAllWorkspaces(false);

  // Show dock on macOS
  if (process.platform === 'darwin') {
    app.dock.show();
  }

  console.log('Lockdown mode disengaged');
}

// Show completion / goal reached (exit lockdown, user is free to go)
function showCompletion() {
  if (!mainWindow) return;

  isSessionActive = false;

  // Clear the focus enforcement interval
  if (lockdownInterval) {
    clearInterval(lockdownInterval);
    lockdownInterval = null;
  }

  // Unregister global shortcuts
  globalShortcut.unregisterAll();

  // Exit kiosk and fullscreen - user is free now
  mainWindow.setKiosk(false);
  mainWindow.setFullScreen(false);
  mainWindow.setAlwaysOnTop(false);
  mainWindow.setClosable(true);
  mainWindow.setMinimizable(true);
  mainWindow.setVisibleOnAllWorkspaces(false);

  // Show dock on macOS
  if (process.platform === 'darwin') {
    app.dock.show();
  }

  console.log('Goal reached - lockdown released');
}

// IPC Handlers

// Start a writing session
ipcMain.handle('start-session', async (event, config) => {
  sessionConfig = config;

  // Only enter lockdown if strict mode is enabled
  if (config.strictMode !== false) {
    enterLockdown();
  } else {
    // Non-strict mode: just track that a session is active (for save purposes)
    isSessionActive = true;
    // Enter fullscreen for focus, but don't lock
    if (mainWindow) {
      mainWindow.setFullScreen(true);
    }
  }

  return { success: true };
});

// Goal reached - show completion screen
ipcMain.handle('goal-reached', async () => {
  // Handle based on whether strict mode was enabled
  if (sessionConfig && sessionConfig.strictMode !== false) {
    showCompletion();
  } else {
    // Non-strict mode: just mark session as complete (already not locked)
    isSessionActive = false;
  }
  return { success: true };
});

// End a writing session
ipcMain.handle('end-session', async (event, { content, stats }) => {
  // Save final content
  if (content) {
    await saveContent(content);
    await archiveDraft(content, stats);
  }

  // Handle exit based on whether strict mode was enabled
  if (sessionConfig && sessionConfig.strictMode !== false) {
    exitLockdown();
  } else {
    // Non-strict mode: just exit fullscreen
    isSessionActive = false;
    if (mainWindow) {
      mainWindow.setFullScreen(false);
    }
  }
  sessionConfig = null;

  return { success: true };
});

// Emergency exit
ipcMain.handle('emergency-exit', async (event, { content }) => {
  // Save content before emergency exit
  if (content) {
    await saveContent(content);
  }

  // Handle exit based on whether strict mode was enabled
  if (sessionConfig && sessionConfig.strictMode !== false) {
    exitLockdown();
  } else {
    // Non-strict mode: just exit fullscreen
    isSessionActive = false;
    if (mainWindow) {
      mainWindow.setFullScreen(false);
    }
  }
  sessionConfig = null;

  return { success: true };
});

// Save content (auto-save)
ipcMain.handle('save-content', async (event, content) => {
  return await saveContent(content);
});

async function saveContent(content) {
  try {
    const filePath = getCurrentDraftPath();
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true, path: filePath };
  } catch (error) {
    console.error('Error saving content:', error);
    return { success: false, error: error.message };
  }
}

// Archive a completed draft
async function archiveDraft(content, stats) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${timestamp}.txt`;
    const filePath = path.join(getDraftsPath(), filename);

    // Create header with stats
    const header = `# Focus Writer Pro Draft
# Date: ${new Date().toLocaleString()}
# Words: ${stats?.words || 0}
# Session Duration: ${stats?.duration || 'N/A'}
# ---

`;

    fs.writeFileSync(filePath, header + content, 'utf-8');

    // Update sessions log
    await logSession(stats, filePath);

    return { success: true, path: filePath };
  } catch (error) {
    console.error('Error archiving draft:', error);
    return { success: false, error: error.message };
  }
}

// Log session to history
async function logSession(stats, draftPath) {
  try {
    const sessionsPath = getSessionsPath();
    let sessions = [];

    if (fs.existsSync(sessionsPath)) {
      const data = fs.readFileSync(sessionsPath, 'utf-8');
      sessions = JSON.parse(data);
    }

    sessions.push({
      date: new Date().toISOString(),
      words: stats?.words || 0,
      duration: stats?.duration || null,
      goalType: stats?.goalType || null,
      goalValue: stats?.goalValue || null,
      completed: stats?.completed || false,
      draftPath: draftPath
    });

    fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error logging session:', error);
  }
}

// Load current draft
ipcMain.handle('load-draft', async () => {
  try {
    const filePath = getCurrentDraftPath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const stats = fs.statSync(filePath);
      return {
        success: true,
        content: content,
        lastModified: stats.mtime
      };
    }
    return { success: true, content: '', lastModified: null };
  } catch (error) {
    console.error('Error loading draft:', error);
    return { success: false, error: error.message };
  }
});

// Clear current draft (start fresh)
ipcMain.handle('clear-draft', async () => {
  try {
    const filePath = getCurrentDraftPath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true };
  } catch (error) {
    console.error('Error clearing draft:', error);
    return { success: false, error: error.message };
  }
});

// Load session history
ipcMain.handle('load-sessions', async () => {
  try {
    const sessionsPath = getSessionsPath();
    if (fs.existsSync(sessionsPath)) {
      const data = fs.readFileSync(sessionsPath, 'utf-8');
      return { success: true, sessions: JSON.parse(data) };
    }
    return { success: true, sessions: [] };
  } catch (error) {
    console.error('Error loading sessions:', error);
    return { success: false, error: error.message };
  }
});

// Save settings
ipcMain.handle('save-settings', async (event, settings) => {
  try {
    const settingsPath = getSettingsPath();
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('Error saving settings:', error);
    return { success: false, error: error.message };
  }
});

// Load settings
ipcMain.handle('load-settings', async () => {
  try {
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8');
      return { success: true, settings: JSON.parse(data) };
    }
    return {
      success: true,
      settings: {
        theme: 'dark',
        fontSize: 'medium',
        fontFamily: 'serif',
        strictMode: true
      }
    };
  } catch (error) {
    console.error('Error loading settings:', error);
    return { success: false, error: error.message };
  }
});

// Get documents path for display
ipcMain.handle('get-documents-path', async () => {
  return getDocumentsPath();
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Handle uncaught exceptions gracefully
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  // Try to exit lockdown if we crash during a session
  if (isSessionActive) {
    exitLockdown();
  }
});
