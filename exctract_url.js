const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3");
const os = require("os");
const activeWindow = require("active-win");
const chromeUserData = path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "User Data");
const localStatePath = path.join(chromeUserData, "Local State");

function readHistory(tempPath) {
    return new Promise((resolve) => {
        const db = new sqlite3.Database(tempPath, sqlite3.OPEN_READONLY);
        const query = `
                    SELECT 
                        urls.url AS url,
                        urls.title AS title,
                        datetime((urls.last_visit_time / 1000000) - 11644473600, 'unixepoch') AS last_visit
                    FROM urls
                    WHERE datetime((urls.last_visit_time / 1000000) - 11644473600, 'unixepoch') > datetime('now', '-24 hours')
                    ORDER BY urls.last_visit_time DESC
            `;

        db.all(query, (err, rows) => {
            db.close();
            if (err) return resolve([]);
            resolve(rows);
        });
    });
}

function matchActiveTitleToHistory(history, currentApp, profile) {
    let historyMatches = [];
    for (const h of history) {
        const stringResult = compareStrings(currentApp.title.toLowerCase().trim(), h.title || "", h.url);
        if (stringResult.isMatch) {
            historyMatches.push(stringResult);
        }
    }

    if (historyMatches.length > 0) {
        let foundedApp = currentApp;
        foundedApp['historyMatches'] = getTopElementByDetails(historyMatches);
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
                return results;
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
        // Step 1: Get today's date and file path
        const today = new Date().toISOString().slice(0, 10); // e.g. '2025-10-31'
        const filePath = path.join(__dirname, `${today}.json`);

        // Step 2: Read existing data (if file exists)
        let existingData = [];
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            existingData = JSON.parse(fileContent || '[]');
        }

        // Step 3: Append new data
        existingData.push(data);

        // Step 4: Write back to file
        fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), 'utf-8');

        console.log(`✅ Data saved to ${filePath}`);
    } catch (err) {
        console.error('❌ Error saving data:', err);
    }
}

// setInterval(async () => {
//     console.log("\n\n------------- Checking -------------")
//     const currentApplication = activeWindow.sync();
//     if (!currentApplication) return;
//     if (
//         currentApplication.owner.path.toLowerCase().includes("chrome") ||
//         currentApplication.owner.path.toLowerCase().includes("edge") ||
//         currentApplication.owner.path.toLowerCase().includes("brave")
//     ) {
//         const findApplication = await createPaths(currentApplication);
//         console.log(findApplication)
//     }
//     console.log("------------- End -------------")
// }, 5000)