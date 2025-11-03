const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();
let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

    // Start app and create window. Also start the live watcher and the extractor script when ready.
    app.whenReady().then(() => {
        createWindow();
        setupLiveJsonWatcher();

        // require and start the URL extractor script so its setInterval runs in the main process
        try {
            require(path.join(__dirname, 'exctract_url.js'));
            console.log('exctract_url started');
        } catch (err) {
            console.warn('Failed to start exctract_url:', err);
        }
    });

// --- Live data watcher ---
// Watches store data and sends updates to renderer via 'live-data' IPC channel
function setupLiveJsonWatcher(pollInterval = 2000) {
    let lastData = null;

    async function checkAndSend() {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const key = `data.${today}`;
        
        try {
            const currentData = store.get(key, []);
            if (JSON.stringify(currentData) !== JSON.stringify(lastData)) {
                lastData = currentData;
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('live-data', currentData);
                }
            }
        } catch (err) {
            console.warn('live-data: failed to get data from store', err);
            if (lastData !== null) {
                lastData = null;
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('live-data', []);
                }
            }
        }
    }

    // Start polling shortly after app is ready so `mainWindow` exists
    setTimeout(() => {
        checkAndSend();
        setInterval(checkAndSend, pollInterval);
    }, 1000);
}

// (watcher started in the main whenReady handler above)

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle('ping', () => {
    return 'pong from main process';
});

// provide handlers for store operations
ipcMain.handle('get-live-data', async () => {
    const today = new Date().toISOString().slice(0, 10);
    try {
        return store.get(`data.${today}`, []);
    } catch (err) {
        console.warn('get-live-data error', err);
        return [];
    }
});

ipcMain.handle('store-set-data', async (event, { key, data }) => {
    try {
        store.set(key, data);
        return true;
    } catch (err) {
        console.warn('store-set-data error', err);
        return false;
    }
});

ipcMain.handle('store-get-data', async (event, key) => {
    try {
        return store.get(key);
    } catch (err) {
        console.warn('store-get-data error', err);
        return null;
    }
});

// Open external URL in default browser
ipcMain.handle('open-external', async (event, url) => {
    try {
        const { shell } = require('electron');
        await shell.openExternal(url);
        return true;
    } catch (err) {
        console.warn('open-external failed', err);
        return false;
    }
});
