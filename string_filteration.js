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
    // Preserve original casing while normalizing punctuation and whitespace.
    return text
        .replace(/[^\w\s]/g, '') // Remove punctuation (preserve letters and numbers)
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

module.exports = { getTopElementByDetails, compareStrings }