const { contextBridge } = require('electron');

// Expose a minimal API surface to the renderer process.
// IPC channels will be added in subsequent issues as features require them.
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
});
