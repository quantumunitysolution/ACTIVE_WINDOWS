const fs = require("fs");
const path = require("path");
const Database = require('better-sqlite3');
const os = require("os");
const activeWindow = require("active-win");
const setupDefaultPaths = require("./history_path");
const stringFilter = require("./string_filteration");
const Store = require('electron-store');

const store = new Store();
let chromeUserData;
let localStatePath;

function readHistory(tempPath) {
    return new Promise((resolve) => {
        try {
            const db = new Database(tempPath, { readonly: true });
            const query = `
                SELECT 
                urls.url AS url,
                urls.title AS title,
                datetime((urls.last_visit_time / 1000000) - 11644473600, 'unixepoch') AS last_visit
                FROM urls
                WHERE datetime((urls.last_visit_time / 1000000) - 11644473600, 'unixepoch') > datetime('now', '-24 hours')
                ORDER BY urls.last_visit_time DESC
            `;

            const stmt = db.prepare(query);
            const rows = stmt.all(); // synchronous
            db.close();

            resolve(rows);
        } catch (err) {
            console.error('Error reading history:', err);
            resolve([]);
        }
    });
}


function matchActiveTitleToHistory(history, currentApp, profile) {
    let historyMatches = [];
    for (const h of history) {
        const stringResult = stringFilter.compareStrings(currentApp.title.trim(), h.title || "", h.url);
        if (stringResult.isMatch) {
            historyMatches.push(stringResult);
        }
    }

    if (historyMatches.length > 0) {
        let foundedApp = currentApp;
        foundedApp['historyMatches'] = stringFilter.getTopElementByDetails(historyMatches);
        foundedApp['profile'] = profile;
        return foundedApp;
    } else {
        return null;
    }
}

const createPaths = async (currentApp) => {
    try {
        const raw = fs.readFileSync(localStatePath, "utf-8");
        const localState = JSON.parse(raw);
        const lastActive = localState?.profile?.last_active_profiles;
        const lastUsedProfile = localState?.profile?.last_used;
        console.log(lastActive, localState?.profile?.last_used);
        let results = [];
        if (Array.isArray(lastActive) && lastActive.length > 0) {
            const tempPaths = lastActive.map((profile) => {
                const tempPath = path.join(os.tmpdir(), `${profile}.db`);
                const localStatePath = path.join(chromeUserData, profile, "History");
                fs.copyFileSync(localStatePath, tempPath);
                return { tempPath, profile };
            })
            for (let i = 0; i < tempPaths.length;) {
                let history = await readHistory(tempPaths[i].tempPath);
                if (history.length === 0) {
                    console.log("⚠️ No history found.");
                    i++;
                } else {
                    const result = await matchActiveTitleToHistory(history, currentApp, tempPaths[i].profile);
                    results.push(result);
                    i++;
                }
            }
            results = results.filter((value) => value);
            if (results.length > 1) {
                let defaultProfile = results.filter((result) => result.profile == lastUsedProfile);
                if (defaultProfile.length > 0) {
                    return defaultProfile[0];
                } else {
                    return results[0];
                }
            } else if (results.length > 0) {
                return results[0]
            } else {
                return null;
            }
        }
    } catch (err) {
        console.warn("Error while getting local state:", err);
    }
}

function saveResult(data) {
    try {
        if (!data) {
            return;
        }

        // Timestamps: set in_time on the incoming log and out_time on the previous log
        const now = new Date().toISOString();
        data.in_time = now;
        // Ensure out_time exists but null until closed
        data.out_time = null;

        // Get today's date as the key
        const today = new Date().toISOString().slice(0, 10);
        const key = `data.${today}`;

        // Get existing data from store (synchronous in main process)
        let existingData = store.get(key, []);

        // If there is a previous entry without out_time, set its out_time to now
        if (existingData && existingData.length > 0) {
            const prev = existingData[existingData.length - 1];
            if (prev && (prev.out_time === undefined || prev.out_time === null)) {
                try {
                    prev.out_time = now;
                } catch (e) {
                    // defensive: if prev is immutable for some reason, ignore
                    console.warn('Could not set prev.out_time', e);
                }
            }
        }

        // Append the new log
        existingData.push(data);

        // Save back to store
        store.set(key, existingData);

        console.log(`✅ Data saved to store for ${today}`);
    } catch (err) {
        console.error('❌ Error saving data:', err);
    }
}

function applicationName(path, browserPaths) {
    let currentApplication = "";
    if (path.toLowerCase().includes("chrome")) {
        currentApplication = browserPaths.chrome;
    } else if (path.toLowerCase().includes("edge") || path.toLowerCase().includes("msedge")) {
        currentApplication = browserPaths.edge;
    } else if (path.toLowerCase().includes("brave")) {
        currentApplication = browserPaths.brave;
    } else if (path.toLowerCase().includes("vivaldi")) {
        currentApplication = browserPaths.vivaldi;
    } else if (path.toLowerCase().includes("seamonkey")) {
        currentApplication = browserPaths.seamonkey;
    } else if (path.toLowerCase().includes("torch")) {
        currentApplication = browserPaths.torch;
    } else if (path.toLowerCase().includes("opera")) {
        currentApplication = browserPaths.opera;
    } else if (path.toLowerCase().includes("firefox")) {
        currentApplication = browserPaths.firefox;
    } else if (path.toLowerCase().includes("avast")) {
        currentApplication = browserPaths.avast;
    } else {
        currentApplication = false;
    }
    return currentApplication;
}

setInterval(async () => {
    console.log("\n\n------------- Checking -------------")
    const currentApplication = activeWindow.sync();
    console.log("current", currentApplication)
    if (!currentApplication) return;
    if (currentApplication?.owner.path) {
        if (applicationName(currentApplication.owner.path, setupDefaultPaths.setupDefaultPaths()) != false) {
            let browserPath = applicationName(currentApplication.owner.path, setupDefaultPaths.setupDefaultPaths());
            console.log("browserPath >> ", browserPath)
            chromeUserData = path.join(browserPath);
            localStatePath = path.join(chromeUserData, "Local State");
            const findApplication = await createPaths(currentApplication);
            if (findApplication) {
                console.log("Found Application:", findApplication);
                saveResult(findApplication);
            } else {
                console.log("No Application Found:", findApplication);
            }
        }
    }
    console.log("------------- End -------------")
}, 10000)