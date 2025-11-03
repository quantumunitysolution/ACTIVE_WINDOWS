const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

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

// --- Live JSON data watcher ---
// Watches JSON files saved by `exctract_url.js` (files named YYYY-MM-DD.json in the app dir)
// and sends their parsed contents to renderer via 'live-data' IPC channel when they change.
function setupLiveJsonWatcher(pollInterval = 2000) {
    let lastMtime = 0;

    async function checkAndSend() {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const filePath = path.join(__dirname, `${today}.json`);

        try {
            const stat = fs.statSync(filePath);
            if (stat.mtimeMs !== lastMtime) {
                lastMtime = stat.mtimeMs;
                const content = fs.readFileSync(filePath, 'utf8');
                let parsed = [];
                try {
                    parsed = JSON.parse(content || '[]');
                } catch (err) {
                    console.warn('live-json: failed to parse JSON', err);
                }

                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('live-data', parsed);
                }
            }
        } catch (err) {
            // File may not exist yet — if previously had data, reset and notify empty
            if (lastMtime !== 0) {
                lastMtime = 0;
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

// provide a handler so renderer can ask for the current live data on demand
ipcMain.handle('get-live-data', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const filePath = path.join(__dirname, `${today}.json`);
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content || '[]');
        }
    } catch (err) {
        console.warn('get-live-data error', err);
    }
    return [];
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
