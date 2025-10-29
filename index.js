// // hybrid_probe.js
// // Usage: node hybrid_probe.js

// import { execFile, exec, spawn } from "child_process";
// import http from "http";
// import fs from "fs";
// import path from "path";

// const TEMP_PROFILE = path.join(process.env.TEMP || "C:\\Temp", "active-url-profile");
// const DEFAULT_PORT = 9222;

// // --- Helper to run the native active window detector (C++ binary) ---
// function runActiveWindowHelper(exePath = "active_url.exe") {
//     return new Promise((resolve, reject) => {
//         execFile(exePath, { windowsHide: true, timeout: 2000 }, (err, stdout) => {
//             if (err) return reject(err);
//             try {
//                 const obj = JSON.parse(stdout);
//                 resolve(obj);
//             } catch (e) {
//                 reject(e);
//             }
//         });
//     });
// }

// // --- Helper to query process command line (PowerShell) ---
// function getProcessCommandLine(pid) {
//     return new Promise((resolve) => {
//         const psCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\\"ProcessId=${pid}\\\" | Select-Object -ExpandProperty CommandLine"`;
//         exec(psCmd, { windowsHide: true, timeout: 3000 }, (err, stdout) => {
//             if (err) return resolve(null);
//             resolve(stdout ? stdout.toString().trim() : "");
//         });
//     });
// }

// // --- Check if a CDP (Chrome DevTools Protocol) endpoint responds ---
// function checkCdpOnPort(port) {
//     return new Promise((resolve) => {
//         const options = {
//             hostname: "127.0.0.1",
//             port,
//             path: "/json/list",
//             method: "GET",
//             timeout: 1000,
//         };
//         const req = http.request(options, (res) => {
//             let data = "";
//             res.setEncoding("utf8");
//             res.on("data", (chunk) => (data += chunk));
//             res.on("end", () => {
//                 try {
//                     const pages = JSON.parse(data);
//                     resolve({ ok: true, pages });
//                 } catch {
//                     resolve({ ok: false });
//                 }
//             });
//         });
//         req.on("error", () => resolve({ ok: false }));
//         req.on("timeout", () => {
//             req.destroy();
//             resolve({ ok: false });
//         });
//         req.end();
//     });
// }

// // --- Scan ports 9222–9232 for active CDP connections ---
// async function tryFindCdpAndMatchTitle(windowTitle) {
//     for (let port = 9222; port <= 9232; port++) {
//         const res = await checkCdpOnPort(port);
//         if (res.ok && Array.isArray(res.pages)) {
//             for (const p of res.pages) {
//                 if (!p) continue;
//                 const title = (p.title || "").toLowerCase();
//                 const url = p.url || "";
//                 if (!title && !url) continue;
//                 if (windowTitle && title && windowTitle.toLowerCase().includes(title)) {
//                     return { port, matched: p };
//                 }
//                 const domain = (url || "").split("/")[2] || "";
//                 if (windowTitle && domain && windowTitle.toLowerCase().includes(domain.toLowerCase())) {
//                     return { port, matched: p };
//                 }
//             }
//             if (res.pages.length > 0) return { port, matched: res.pages[0] };
//         }
//     }
//     return null;
// }

// // --- Launch a controlled Chrome instance with remote debugging enabled ---
// async function launchDebugChrome(chromePath) {
//     return new Promise((resolve, reject) => {
//         if (!fs.existsSync(chromePath)) {
//             return reject(new Error("Chrome path not found: " + chromePath));
//         }
//         if (!fs.existsSync(TEMP_PROFILE)) fs.mkdirSync(TEMP_PROFILE, { recursive: true });

//         console.log(`Launching Chrome with remote debugging at port ${DEFAULT_PORT}...`);
//         const chrome = spawn(chromePath, [
//             `--remote-debugging-port=${DEFAULT_PORT}`,
//             `--user-data-dir=${TEMP_PROFILE}`,
//             "--no-first-run",
//             "--no-default-browser-check",
//             "--new-window",
//             "about:blank",
//         ], { detached: true, stdio: "ignore" });

//         chrome.unref();

//         // Wait a bit for Chrome to start
//         setTimeout(async () => {
//             const res = await checkCdpOnPort(DEFAULT_PORT);
//             if (res.ok) resolve(res);
//             else reject(new Error("CDP not responding after Chrome launch"));
//         }, 1500);
//     });
// }

// // --- Main execution loop ---
// async function main() {
//     try {
//         const active = await runActiveWindowHelper();
//         console.log("Active window info:", active);

//         const { pid, processName, title } = active;
//         if (!pid || !processName) return;

//         const lower = processName.toLowerCase();

//         // --- Handle Chromium-based browsers ---
//         if (lower.includes("chrome") || lower.includes("msedge") || lower.includes("brave")) {
//             console.log("Detected Chromium-based browser process.");

//             const cmdline = await getProcessCommandLine(pid);
//             console.log("Process command line:", cmdline || "(not available)");

//             const profileMatch = cmdline ? cmdline.match(/--profile-directory=([^\\s"]+)/i) : null;
//             const userDataMatch = cmdline ? cmdline.match(/--user-data-dir=([^\\s"]+)/i) : null;
//             const remoteMatch = cmdline ? cmdline.match(/--remote-debugging-port=(\d+)/i) : null;

//             console.log("Profile directory flag:", profileMatch ? profileMatch[1] : "(none)");
//             console.log("User data dir flag:", userDataMatch ? userDataMatch[1] : "(none)");
//             console.log("Remote debugging port in cmdline:", remoteMatch ? remoteMatch[1] : "(none)");

//             // --- If remote-debugging-port is active, connect directly ---
//             if (remoteMatch && remoteMatch[1]) {
//                 const port = parseInt(remoteMatch[1], 10);
//                 const res = await checkCdpOnPort(port);
//                 if (res.ok) {
//                     const match = res.pages.find((p) => title && title.toLowerCase().includes(p.title?.toLowerCase()));
//                     console.log("Matched page via CDP:", match ? match.url : res.pages[0]?.url);
//                     return;
//                 }
//             }

//             // --- Try scanning for existing CDP endpoints ---
//             const found = await tryFindCdpAndMatchTitle(title || "");
//             if (found) {
//                 console.log(`Found existing CDP at port ${found.port}:`, found.matched.url);
//                 return;
//             }

//             // --- Auto-launch Chrome with debugging if nothing found ---
//             console.log("No existing CDP found. Attempting to launch new Chrome instance...");
//             const chromePaths = [
//                 "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
//                 "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
//                 "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
//             ];
//             const chromePath = chromePaths.find((p) => fs.existsSync(p));
//             if (chromePath) {
//                 try {
//                     const res = await launchDebugChrome(chromePath);
//                     const tab = res.pages?.[0];
//                     if (tab) console.log("Launched Chrome with CDP. Active tab:", tab.url);
//                 } catch (e) {
//                     console.error("Failed to auto-launch Chrome:", e.message);
//                 }
//             } else {
//                 console.log("Chrome/Edge executable not found on system.");
//             }
//             return;
//         }

//         // --- Handle Firefox separately ---
//         else if (lower.includes("firefox")) {
//             console.log("Detected Firefox — CDP not applicable yet. Use UIAutomation or extension-based approach.");
//             return;
//         }

//         console.log("Active process is not a targeted browser. Window title:", title);
//     } catch (err) {
//         console.error("Error:", err.message || err);
//     }
// }

// // --- Run continuously like setInterval ---
// setInterval(main, 2000);





// Temp code 
// cdp_driver.js
import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';

const TEMP_PROFILE = path.join(process.env.TEMP || 'C:\\Temp', 'active-url-poc');
const CHROME_PATHS = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

async function fetchJson(port, path = '/json/list') {
    return new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port, path, method: 'GET', timeout: 1000 }, (res) => {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.end();
    });
}

async function scanPorts(start = 9222, end = 9232) {
    for (let p = start; p <= end; ++p) {
        try {
            const pages = await fetchJson(p, '/json/list');
            return { port: p, pages };
        } catch (e) { }
    }
    return null;
}

async function waitForCdp(port, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            const pages = await fetchJson(port, '/json/list');
            return { port, pages };
        } catch { await new Promise(r => setTimeout(r, 250)); }
    }
    throw new Error('CDP timeout');
}

function launchChrome(chromePath, port = 9222) {
    if (!fs.existsSync(chromePath)) throw new Error('Chrome binary not found');
    if (!fs.existsSync(TEMP_PROFILE)) fs.mkdirSync(TEMP_PROFILE, { recursive: true });
    const child = spawn(chromePath, [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${TEMP_PROFILE}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--new-window',
        'about:blank'
    ], { detached: true, stdio: 'ignore' });
    child.unref();
    return child;
}

async function inspectViaWebSocket(wsUrl) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        const id = 1;
        ws.on('open', () => {
            ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: 'document.location.href' } }));
        });
        ws.on('message', (d) => {
            const obj = JSON.parse(d);
            if (obj.id === id) {
                const value = obj.result?.result?.value ?? null;
                ws.close();
                resolve(value);
            }
        });
        ws.on('error', reject);
        setTimeout(() => reject(new Error('ws timeout')), 5000);
    });
}

(async () => {
    try {
        let found = await scanPorts();
        if (!found) {
            console.log('No open CDP. Launching Chrome temporarily...');
            const chromePath = CHROME_PATHS.find(p => fs.existsSync(p));
            if (!chromePath) return console.error('No Chrome/Edge binary found');
            launchChrome(chromePath, 9222);
            found = await waitForCdp(9222, 8000);
        }
        console.log('CDP found at port', found.port);
        console.log('Pages:', found.pages.map(p => ({ title: p.title, url: p.url })));
        const target = found.pages[0];
        if (target && target.webSocketDebuggerUrl) {
            const url = await inspectViaWebSocket(target.webSocketDebuggerUrl);
            console.log('Tab href via Runtime.evaluate:', url);
        }
    } catch (e) {
        console.error('Error:', e.message || e);
    }
})();
