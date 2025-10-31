const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3");
const os = require("os");
const activeWindow = require("active-win");

const chromeUserData = path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "User Data");
const localStatePath = path.join(chromeUserData, "Local State");
let history = [];
let currentApplication;
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
                    ORDER BY urls.last_visit_time DESC
            `;

        db.all(query, (err, rows) => {
            db.close();
            if (err) return resolve([]);
            resolve(rows);
        });
    });
}

async function matchActiveTitleToHistory() {
    let bestMatch = { score: 0, entry: null };

    console.log("------------- Checking -------------")
    let historyMatches = [];
    for (const h of history) {
        const stringResult = compareStrings(currentTitle, h.title || "", h.url);
        if (stringResult.isMatch) {
            historyMatches.push(stringResult);
        }
    }
    console.log(getTopElementByDetails(historyMatches))
    currentApplication['historyMatches'] = getTopElementByDetails(historyMatches);
    saveResult(currentApplication);
    console.log("------------- End -------------")
}

setInterval(async () => {
    currentApplication = activeWindow.sync();
    if (!currentApplication) return;
    if (
        currentApplication.owner.path.toLowerCase().includes("chrome") ||
        currentApplication.owner.path.toLowerCase().includes("edge") ||
        currentApplication.owner.path.toLowerCase().includes("brave")
    ) {
        currentTitle = currentApplication.title.toLowerCase().trim();
        createPaths();
    }
}, 2000);

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
        // console.log("history", history.length)
        if (history.length === 0) {
            return console.log("⚠️ No history found.");
        } else {
            matchActiveTitleToHistory();
        }
    } catch (err) {
        console.error("❌ Failed to copy Chrome history file:", err);
    }
}

function getTopElementByDetails(data) {
    if (!Array.isArray(data) || data.length === 0) return null;

    return data.reduce((best, current) => {
        const sumDetails = (obj) =>
            Object.values(obj.details).reduce((sum, val) => sum + val, 0);

        const bestScore = sumDetails(best);
        const currentScore = sumDetails(current);

        return currentScore > bestScore ? current : best;
    });
}

function compareStrings(inputString, optionString, url, threshold = 0.3) {
    if (!inputString || !optionString) {
        return {
            isMatch: false,
            score: 0,
            details: null
        };
    }

    const normalizedInput = normalizeText(inputString);
    const normalizedOption = normalizeText(optionString);
    const inputTokens = tokenize(inputString);
    const optionTokens = tokenize(optionString);

    // Calculate all scoring metrics
    const jaccardScore = calculateJaccardSimilarity(inputTokens, optionTokens);
    const tokenOverlap = calculateTokenOverlap(inputTokens, optionTokens);
    const substringScore = calculateSubstringScore(normalizedInput, normalizedOption);
    const positionalBonus = calculatePositionalBonus(inputTokens, optionTokens);

    // Levenshtein similarity (normalized)
    const maxLen = Math.max(normalizedInput.length, normalizedOption.length);
    const levenshteinScore = maxLen === 0 ? 0 : 1 - (calculateLevenshteinDistance(normalizedInput, normalizedOption) / maxLen);

    // Exact match bonus
    const exactMatchBonus = normalizedInput === normalizedOption ? 1 : 0;

    // Contains bonus
    const containsBonus = normalizedOption.includes(normalizedInput) ||
        normalizedInput.includes(normalizedOption) ? 0.5 : 0;

    // Weighted composite score
    const compositeScore =
        exactMatchBonus * 2.0 +
        jaccardScore * 0.3 +
        tokenOverlap * 0.25 +
        substringScore * 0.2 +
        levenshteinScore * 0.15 +
        positionalBonus * 0.05 +
        containsBonus * 0.05;

    return {
        isMatch: compositeScore >= threshold,
        score: parseFloat(compositeScore.toFixed(4)),
        inputString,
        optionString,
        url,
        details: {
            jaccard: parseFloat(jaccardScore.toFixed(3)),
            tokenOverlap: parseFloat(tokenOverlap.toFixed(3)),
            substring: parseFloat(substringScore.toFixed(3)),
            levenshtein: parseFloat(levenshteinScore.toFixed(3)),
            positional: parseFloat(positionalBonus.toFixed(3)),
            exactMatch: exactMatchBonus,
            contains: containsBonus
        }
    };
}

function normalizeText(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ')     // Normalize whitespace
        .trim();
}

function tokenize(text) {
    return normalizeText(text).split(' ').filter(word => word.length > 0);
}

function calculateLevenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return matrix[len1][len2];
}

function calculateJaccardSimilarity(tokens1, tokens2) {
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
}

function calculateTokenOverlap(tokens1, tokens2) {
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    const intersection = [...set1].filter(x => set2.has(x));

    return intersection.length / Math.max(set1.size, set2.size);
}

function calculateSubstringScore(str1, str2) {
    const shorter = str1.length < str2.length ? str1 : str2;
    const longer = str1.length >= str2.length ? str1 : str2;

    if (longer.includes(shorter)) return 1;

    // Find longest common substring
    let maxLen = 0;
    for (let i = 0; i < shorter.length; i++) {
        for (let j = i + 1; j <= shorter.length; j++) {
            const substr = shorter.substring(i, j);
            if (longer.includes(substr) && substr.length > maxLen) {
                maxLen = substr.length;
            }
        }
    }

    return maxLen / Math.max(shorter.length, 1);
}

function calculatePositionalBonus(tokens1, tokens2) {
    let score = 0;
    const minLen = Math.min(tokens1.length, tokens2.length);

    for (let i = 0; i < minLen; i++) {
        if (tokens1[i] === tokens2[i]) {
            score += (minLen - i) / minLen; // Earlier matches get higher weight
        }
    }

    return score / Math.max(tokens1.length, tokens2.length);
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
