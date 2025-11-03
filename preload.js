const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('ping'),

  // Subscribe to live data updates from main process. `callback` is executed in renderer.
  onLiveData: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('live-data', listener);
    // return an unsubscribe function
    return () => ipcRenderer.removeListener('live-data', listener);
  },

  // Request current live data on demand
  getLiveData: () => ipcRenderer.invoke('get-live-data'),
  
  // Store operations
  storeSetData: (key, data) => ipcRenderer.invoke('store-set-data', { key, data }),
  storeGetData: (key) => ipcRenderer.invoke('store-get-data', key),
  // Open an external URL in the default browser (main process will handle)
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
