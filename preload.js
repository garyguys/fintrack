const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fileStorage', {
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, data) => callback(data));
  }
});
