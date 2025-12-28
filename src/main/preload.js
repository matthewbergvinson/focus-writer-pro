const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('focusWriter', {
  // Session management
  startSession: (config) => ipcRenderer.invoke('start-session', config),
  endSession: (data) => ipcRenderer.invoke('end-session', data),
  emergencyExit: (data) => ipcRenderer.invoke('emergency-exit', data),

  // Content management
  saveContent: (content) => ipcRenderer.invoke('save-content', content),
  loadDraft: () => ipcRenderer.invoke('load-draft'),
  clearDraft: () => ipcRenderer.invoke('clear-draft'),

  // Session history
  loadSessions: () => ipcRenderer.invoke('load-sessions'),

  // Settings
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  loadSettings: () => ipcRenderer.invoke('load-settings'),

  // Utilities
  getDocumentsPath: () => ipcRenderer.invoke('get-documents-path'),

  // Event listeners
  onShowExitWarning: (callback) => {
    ipcRenderer.on('show-exit-warning', callback);
    return () => ipcRenderer.removeListener('show-exit-warning', callback);
  }
});
