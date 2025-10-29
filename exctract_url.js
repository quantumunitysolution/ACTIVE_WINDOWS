import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import os from "os";
import { execFile } from "child_process";

const chromeUserData = path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "User Data");
const localStatePath = path.join(chromeUserData, "Local State");
const exePath = "./active_process.exe";
let history = [];
var currentTitle = "";

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
            ORDER BY last_visit_time DESC;
        `;

        db.all(query, (err, rows) => {
            db.close();
            if (err) return resolve([]);
            resolve(rows);
        });
    });
}

function similarity(a, b) {
    a = a.toLowerCase();
    b = b.toLowerCase();
    const len = Math.max(a.length, b.length);
    console.log("Checking Length", len);
    if (len === 0) return 0;
    let same = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] === b[i]) same++;
    }
    return (same / len) * 100;
}

async function matchActiveTitleToHistory() {
    let bestMatch = { score: 0, entry: null };

    console.log("------------- Checking -------------")
    for (const h of history) {
        console.log("currentTitle ===>", currentTitle);
        console.log("h.title ===>", h.title);
        const score = similarity(currentTitle, h.title || "");
        if (score > bestMatch.score) {
            bestMatch = { score, entry: h };
        }
    }
    console.log("------------- End -------------")

    if (bestMatch.entry && bestMatch.score > 70) {
        console.log("\n\n")
        console.log("🌐 Active Tab (Matched):", {
            url: bestMatch.entry.url,
            score: bestMatch.score.toFixed(2) + "%",
        });
    } else {
        console.log("⚠️ No strong match found for:", currentTitle);
    }
}

// 🧭 Run C++ exe to get active window title
function getActiveWindowTitle() {
    return new Promise((resolve) => {
        execFile(exePath, (error, stdout) => {
            if (error) return resolve(null);
            const title = JSON.parse(stdout);
            resolve(title || null);
        });
    });
}

// 🌀 Main loop
setInterval(async () => {
    const process = await getActiveWindowTitle();
    if (!process) return;

    console.log(process[1])

    if (
        process[1].toLowerCase().includes("chrome") ||
        process[1].toLowerCase().includes("edge") ||
        process[1].toLowerCase().includes("brave")
    ) {
        currentTitle = process[3].toLowerCase().trim();
        // await matchActiveTitleToHistory(process[3].toLowerCase().trim());
        createPaths();
    }
}, 1000);

const createPaths = () => {
    try {
        const raw = fs.readFileSync(localStatePath, "utf-8");
        const localState = JSON.parse(raw);
        const lastActive = localState?.profile?.last_active_profiles;
        if (Array.isArray(lastActive) && lastActive.length > 0) {
            lastActive.forEach((value) => {
                const localStatePath = path.join(chromeUserData, value, "History");
                const tempPath = path.join(os.tmpdir(), `${value}.db`);
                copyHistoryFile(localStatePath, tempPath)
            })
        }
    } catch (err) {
        console.warn("Error while getting local state:", err);
    }
}

async function copyHistoryFile(localStatePath, tempPath) {
    try {
        fs.copyFileSync(localStatePath, tempPath);
        history = await readHistory(tempPath);
        if (history.length === 0) {
            return console.log("⚠️ No history found.");
        } else {
            matchActiveTitleToHistory();
        }
    } catch (err) {
        console.error("❌ Failed to copy Chrome history file:", err);
    }
}