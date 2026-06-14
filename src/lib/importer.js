"use strict";
/**
 * CSV Import Engine
 *
 * This module handles the full pipeline for ingesting expenses_export.csv.
 * It never silently discards or fixes data — every anomaly is surfaced.
 *
 * Pipeline:
 *   1. parseCSV()       → raw rows
 *   2. detectAnomalies()→ anomalies per row
 *   3. (User reviews)
 *   4. commitImport()   → write approved rows to DB
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCSV = parseCSV;
exports.detectAnomalies = detectAnomalies;
exports.computeSplits = computeSplits;
// Known members (names after normalization)
const KNOWN_MEMBERS = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Sam', 'Dev', "Dev's friend Kabir"];
// Membership active dates
const MEMBERSHIP_RANGES = {
    Aisha: { joined: '2026-02-01' },
    Rohan: { joined: '2026-02-01' },
    Priya: { joined: '2026-02-01' },
    Meera: { joined: '2026-02-01', left: '2026-03-31' },
    Sam: { joined: '2026-04-08' },
    Dev: { joined: '2026-03-08', left: '2026-03-14' }, // guest for Goa trip
    "Dev's friend Kabir": { joined: '2026-03-11', left: '2026-03-11' }, // one day
};
// ─── Step 1: Parse raw TSV/CSV ──────────────────────────────────────────────
function parseCSV(content) {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0)
        throw new Error('Empty file');
    // Detect delimiter (tab or comma)
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';
    // Skip header row
    const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = splitLine(lines[i], delimiter);
        const row = {
            rowIndex: i,
            date: (cols[headers.indexOf('date')] || '').trim(),
            description: (cols[headers.indexOf('description')] || '').trim(),
            paid_by: (cols[headers.indexOf('paid_by')] || '').trim(),
            amount: (cols[headers.indexOf('amount')] || '').trim(),
            currency: (cols[headers.indexOf('currency')] || '').trim(),
            split_type: (cols[headers.indexOf('split_type')] || '').trim().toLowerCase(),
            split_with: (cols[headers.indexOf('split_with')] || '').trim(),
            split_details: (cols[headers.indexOf('split_details')] || '').trim(),
            notes: (cols[headers.indexOf('notes')] || '').trim(),
        };
        rows.push(row);
    }
    return rows;
}
function splitLine(line, delimiter) {
    // Handle quoted fields
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        }
        else if (ch === delimiter && !inQuotes) {
            result.push(current);
            current = '';
        }
        else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}
// ─── Step 2: Detect anomalies and build parsed expenses ──────────────────────
function detectAnomalies(rows, usdToInrRate) {
    const parsed = [];
    for (const row of rows) {
        const anomalies = [];
        let skip = false;
        // ── Date parsing ─────────────────────────────────────────────────────────
        let parsedDate = parseDate(row.date);
        if (!parsedDate.date) {
            if (parsedDate.ambiguous) {
                anomalies.push({
                    rowIndex: row.rowIndex,
                    type: 'AMBIGUOUS_DATE',
                    description: `Date "${row.date}" is ambiguous — could be ${parsedDate.options?.join(' or ')}. "04-05-2026" might be Apr 5 or May 4.`,
                    suggestedAction: `Interpreting as DD-MM-YYYY = ${parsedDate.fallback}. Please confirm.`,
                    autoResolved: false,
                    resolvedValue: parsedDate.fallback,
                });
                parsedDate.date = parsedDate.fallback;
            }
            else {
                anomalies.push({
                    rowIndex: row.rowIndex,
                    type: 'MALFORMED_DATE',
                    description: `Date "${row.date}" could not be parsed.`,
                    suggestedAction: 'Manually set the correct date before importing.',
                    autoResolved: false,
                });
                parsedDate.date = new Date().toISOString().slice(0, 10);
            }
        }
        // ── Amount parsing ────────────────────────────────────────────────────────
        let rawAmount = row.amount.replace(/,/g, ''); // strip commas like "1,200"
        if (rawAmount !== row.amount && row.amount.includes(',')) {
            anomalies.push({
                rowIndex: row.rowIndex,
                type: 'MALFORMED_AMOUNT',
                description: `Amount "${row.amount}" contains a comma as a thousands separator.`,
                suggestedAction: `Auto-corrected to ${rawAmount}.`,
                autoResolved: true,
                resolvedValue: rawAmount,
            });
        }
        const amountNum = parseFloat(rawAmount);
        if (isNaN(amountNum)) {
            anomalies.push({
                rowIndex: row.rowIndex,
                type: 'MALFORMED_AMOUNT',
                description: `Amount "${row.amount}" is not a valid number.`,
                suggestedAction: 'Reject this row or manually set the amount.',
                autoResolved: false,
            });
            skip = true;
        }
        // Extra precision (more than 2 decimal places)
        if (!isNaN(amountNum) && amountNum !== Math.round(amountNum * 100) / 100) {
            anomalies.push({
                rowIndex: row.rowIndex,
                type: 'EXTRA_PRECISION',
                description: `Amount ${amountNum} has more than 2 decimal places (sub-paise precision).`,
                suggestedAction: `Will be rounded to ${Math.round(amountNum * 100) / 100}.`,
                autoResolved: true,
                resolvedValue: String(Math.round(amountNum * 100) / 100),
            });
        }
        // Negative amount — treat as refund
        let isRefund = false;
        if (!isNaN(amountNum) && amountNum < 0) {
            isRefund = true;
            anomalies.push({
                rowIndex: row.rowIndex,
                type: 'NEGATIVE_AMOUNT',
                description: `Amount ${amountNum} is negative. "${row.description}" appears to be a refund.`,
                suggestedAction: 'Treating as a refund expense (reduces shared debt proportionally).',
                autoResolved: true,
                resolvedValue: 'refund',
            });
        }
        // Zero amount
        if (!isNaN(amountNum) && amountNum === 0) {
            anomalies.push({
                rowIndex: row.rowIndex,
                type: 'ZERO_AMOUNT',
                description: `Amount is 0 for "${row.description}". Likely a placeholder or duplicate marker.`,
                suggestedAction: 'Skipping this row by default. Approve to import with ₹0.',
                autoResolved: false,
            });
            skip = true;
        }
        // ── Currency ──────────────────────────────────────────────────────────────
        let currency = row.currency.trim().toUpperCase() || 'INR';
        let exchangeRate = 1.0;
        let amountInr = Math.abs(Math.round((amountNum || 0) * 100) / 100);
        if (!row.currency.trim()) {
            anomalies.push({
                rowIndex: row.rowIndex,
                type: 'MISSING_CURRENCY',
                description: `Currency field is blank for "${row.description}".`,
                suggestedAction: 'Defaulting to INR (home currency). Approve to confirm.',
                autoResolved: false,
                resolvedValue: 'INR',
            });
            currency = 'INR';
        }
        if (currency === 'USD') {
            exchangeRate = usdToInrRate;
            amountInr = Math.round(Math.abs(amountNum) * usdToInrRate * 100) / 100;
            anomalies.push({
                rowIndex: row.rowIndex,
                type: 'FOREIGN_CURRENCY',
                description: `Expense "${row.description}" is in USD ($${Math.abs(amountNum)}).`,
                suggestedAction: `Converted to ₹${amountInr} using rate 1 USD = ₹${usdToInrRate}. Confirm rate is correct.`,
                autoResolved: false,
                resolvedValue: String(amountInr),
            });
        }
        // ── Payer ─────────────────────────────────────────────────────────────────
        let paidBy = row.paid_by.trim();
        if (!paidBy) {
            anomalies.push({
                rowIndex: row.rowIndex,
                type: 'MISSING_PAYER',
                description: `No payer recorded for "${row.description}". Note: "${row.notes}".`,
                suggestedAction: 'This expense will be imported with "Unknown" as payer and cannot be settled until resolved.',
                autoResolved: false,
            });
            paidBy = 'Unknown';
        }
        // Case normalization
        const normalizedPayer = normalizeMemberName(paidBy);
        if (normalizedPayer !== paidBy && KNOWN_MEMBERS.includes(normalizedPayer)) {
            anomalies.push({
                rowIndex: row.rowIndex,
                type: 'PAYER_CASE_MISMATCH',
                description: `Payer "${paidBy}" does not match expected capitalization.`,
                suggestedAction: `Auto-corrected to "${normalizedPayer}".`,
                autoResolved: true,
                resolvedValue: normalizedPayer,
            });
            paidBy = normalizedPayer;
        }
        // Unknown payer (e.g., "Priya S")
        const cleanPayer = normalizeMemberName(paidBy);
        if (!KNOWN_MEMBERS.includes(cleanPayer) && paidBy !== 'Unknown') {
            // Try fuzzy match
            const fuzzy = fuzzyMatchMember(cleanPayer);
            if (fuzzy) {
                anomalies.push({
                    rowIndex: row.rowIndex,
                    type: 'UNKNOWN_PAYER',
                    description: `Payer "${row.paid_by}" is not a known member. Closest match: "${fuzzy}".`,
                    suggestedAction: `Suggest mapping to "${fuzzy}". Approve to confirm, reject to skip.`,
                    autoResolved: false,
                    resolvedValue: fuzzy,
                });
                paidBy = fuzzy;
            }
            else {
                anomalies.push({
                    rowIndex: row.rowIndex,
                    type: 'UNKNOWN_PAYER',
                    description: `Payer "${row.paid_by}" is not a known member and no match found.`,
                    suggestedAction: 'Reject this row or manually specify the payer.',
                    autoResolved: false,
                });
            }
        }
        // ── Settlement check ───────────────────────────────────────────────────────
        let isSettlement = false;
        if (!row.split_type && row.notes.toLowerCase().includes('settlement')) {
            isSettlement = true;
            anomalies.push({
                rowIndex: row.rowIndex,
                type: 'SETTLEMENT_AS_EXPENSE',
                description: `"${row.description}" appears to be a settlement payment, not an expense. No split_type set; note says "settlement".`,
                suggestedAction: 'Will be imported as a settlement record (debt payment), not an expense. Approve to confirm.',
                autoResolved: false,
                resolvedValue: 'settlement',
            });
        }
        // Non-expense transfer (deposit)
        if (row.description.toLowerCase().includes('deposit')) {
            anomalies.push({
                rowIndex: row.rowIndex,
                type: 'NON_EXPENSE_TRANSFER',
                description: `"${row.description}" appears to be a deposit/security transfer, not a group expense.`,
                suggestedAction: 'Will be imported as a settlement record. Approve to confirm.',
                autoResolved: false,
                resolvedValue: 'settlement',
            });
            isSettlement = true;
        }
        // ── Split type ─────────────────────────────────────────────────────────────
        const validSplitTypes = ['equal', 'unequal', 'percentage', 'share'];
        let splitType = row.split_type;
        if (!isSettlement && !validSplitTypes.includes(row.split_type)) {
            if (row.split_type === '') {
                splitType = 'equal'; // default
            }
        }
        // ── Split members ──────────────────────────────────────────────────────────
        const rawSplitWith = row.split_with.split(';').map(s => s.trim()).filter(Boolean);
        const splitWith = [];
        for (const name of rawSplitWith) {
            const normalized = normalizeMemberName(name);
            if (KNOWN_MEMBERS.includes(normalized)) {
                // Check if member was active on expense date
                const range = MEMBERSHIP_RANGES[normalized];
                if (range && parsedDate.date) {
                    if (range.left && parsedDate.date > range.left) {
                        anomalies.push({
                            rowIndex: row.rowIndex,
                            type: 'INACTIVE_MEMBER_IN_SPLIT',
                            description: `${normalized} is in the split for "${row.description}" (${parsedDate.date}), but they left the group on ${range.left}.`,
                            suggestedAction: `Remove ${normalized} from the split. Approve to confirm removal.`,
                            autoResolved: false,
                            resolvedValue: `remove:${normalized}`,
                        });
                        continue; // don't add them
                    }
                    if (parsedDate.date < range.joined) {
                        anomalies.push({
                            rowIndex: row.rowIndex,
                            type: 'INACTIVE_MEMBER_IN_SPLIT',
                            description: `${normalized} is in the split for "${row.description}" (${parsedDate.date}), but they only joined on ${range.joined}.`,
                            suggestedAction: `Remove ${normalized} from the split. Approve to confirm removal.`,
                            autoResolved: false,
                            resolvedValue: `remove:${normalized}`,
                        });
                        continue;
                    }
                }
                splitWith.push(normalized);
            }
            else {
                // Unknown member in split (like "Dev's friend Kabir")
                anomalies.push({
                    rowIndex: row.rowIndex,
                    type: 'UNKNOWN_MEMBER_IN_SPLIT',
                    description: `"${name}" in split_with is not a recognized member.`,
                    suggestedAction: `Will be added as a guest member. Approve to confirm.`,
                    autoResolved: false,
                    resolvedValue: `guest:${name}`,
                });
                splitWith.push(name); // keep them, just as guest
            }
        }
        // ── Split details parsing ──────────────────────────────────────────────────
        const splitDetails = {};
        if (row.split_details) {
            const parts = row.split_details.split(';').map(s => s.trim());
            for (const part of parts) {
                const match = part.match(/^(.+?)\s+([\d.]+)%?$/);
                if (match) {
                    const name = normalizeMemberName(match[1].trim());
                    splitDetails[name] = parseFloat(match[2]);
                }
            }
        }
        // Validate percentage splits sum to 100
        if (splitType === 'percentage' && Object.keys(splitDetails).length > 0) {
            const total = Object.values(splitDetails).reduce((a, b) => a + b, 0);
            if (Math.abs(total - 100) > 0.01) {
                anomalies.push({
                    rowIndex: row.rowIndex,
                    type: 'PERCENTAGE_SUM_INVALID',
                    description: `Percentages for "${row.description}" sum to ${total.toFixed(1)}%, not 100%.`,
                    suggestedAction: 'Cannot auto-fix. Please correct the percentages manually before importing this row.',
                    autoResolved: false,
                });
                skip = !isSettlement && true;
            }
        }
        // Conflicting split type + details (equal + share details)
        if (splitType === 'equal' && row.split_details && row.split_details.trim()) {
            anomalies.push({
                rowIndex: row.rowIndex,
                type: 'CONFLICTING_SPLIT_TYPE',
                description: `split_type is "equal" but split_details are also provided for "${row.description}".`,
                suggestedAction: 'For equal splits with identical share counts, result is same. Ignoring split_details.',
                autoResolved: true,
                resolvedValue: 'ignore_details',
            });
        }
        parsed.push({
            rowIndex: row.rowIndex,
            date: parsedDate.date,
            description: row.description,
            paidByName: paidBy,
            amount: skip ? 0 : amountInr,
            originalAmount: Math.round((amountNum || 0) * 100) / 100,
            originalCurrency: currency,
            exchangeRate,
            splitType: splitType || 'equal',
            splitWith,
            splitDetails,
            isRefund,
            isSettlement,
            notes: row.notes,
            anomalies,
        });
    }
    // ── Post-processing: detect duplicates ─────────────────────────────────────
    detectDuplicates(parsed);
    return parsed;
}
function detectDuplicates(parsed) {
    for (let i = 0; i < parsed.length; i++) {
        for (let j = i + 1; j < parsed.length; j++) {
            const a = parsed[i];
            const b = parsed[j];
            if (a.date === b.date &&
                a.paidByName.toLowerCase() === b.paidByName.toLowerCase() &&
                Math.abs(a.originalAmount) === Math.abs(b.originalAmount) &&
                a.description.toLowerCase().replace(/[^a-z0-9]/g, '') ===
                    b.description.toLowerCase().replace(/[^a-z0-9]/g, '')) {
                // Exact duplicate
                const anomaly = {
                    rowIndex: b.rowIndex,
                    type: 'DUPLICATE',
                    description: `Row ${b.rowIndex} appears to be an exact duplicate of row ${a.rowIndex}: "${a.description}" on ${a.date} by ${a.paidByName} for ${a.originalAmount}.`,
                    suggestedAction: `Reject row ${b.rowIndex} (keep row ${a.rowIndex}). Approve to keep both.`,
                    autoResolved: false,
                    resolvedValue: `duplicate_of:${a.rowIndex}`,
                };
                b.anomalies.push(anomaly);
            }
            else if (a.date === b.date &&
                a.paidByName.toLowerCase() !== b.paidByName.toLowerCase() &&
                Math.abs(a.originalAmount - b.originalAmount) < 200 &&
                levenshtein(a.description.toLowerCase(), b.description.toLowerCase()) < 5) {
                // Suspected duplicate with different amounts (Thalassa case)
                const anomaly = {
                    rowIndex: b.rowIndex,
                    type: 'DUPLICATE',
                    description: `Row ${b.rowIndex} ("${b.description}", ₹${b.originalAmount} by ${b.paidByName}) and row ${a.rowIndex} ("${a.description}", ₹${a.originalAmount} by ${a.paidByName}) look like the same dinner logged twice by different people.`,
                    suggestedAction: 'Both rows shown side by side. Pick one to keep, or keep both if they were separate bills.',
                    autoResolved: false,
                    resolvedValue: 'suspected_duplicate',
                };
                b.anomalies.push(anomaly);
            }
        }
    }
}
function parseDate(raw) {
    if (!raw)
        return {};
    // ISO: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw))
        return { date: raw };
    // DD-MM-YYYY
    const ddmm = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (ddmm) {
        const [, dd, mm, yyyy] = ddmm;
        const d = parseInt(dd), m = parseInt(mm);
        // Ambiguous if both could be valid dates (d<=12 AND m<=12)
        if (d <= 12 && m <= 12 && d !== m) {
            const opt1 = `${yyyy}-${mm}-${dd}`; // treat as DD-MM
            const opt2 = `${yyyy}-${dd}-${mm}`; // treat as MM-DD
            return { ambiguous: true, options: [opt1, opt2], fallback: opt1 };
        }
        if (d > 12) {
            // Must be DD-MM-YYYY
            return { date: `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}` };
        }
        return { date: `${yyyy}-${mm}-${dd}` };
    }
    // "Mar-14" format
    const shortMonth = raw.match(/^([A-Za-z]{3})-(\d{1,2})$/);
    if (shortMonth) {
        const months = {
            Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
            Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
        };
        const mo = months[shortMonth[1]];
        if (mo) {
            const day = shortMonth[2].padStart(2, '0');
            return { date: `2026-${mo}-${day}` };
        }
    }
    return {};
}
// ─── Helper: Member name normalization ────────────────────────────────────────
function normalizeMemberName(raw) {
    if (!raw)
        return raw;
    // Title-case the name
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase().replace(/\b(\w)/g, c => c.toUpperCase());
}
function fuzzyMatchMember(name) {
    for (const known of KNOWN_MEMBERS) {
        if (levenshtein(name.toLowerCase(), known.toLowerCase()) <= 2)
            return known;
        if (known.toLowerCase().startsWith(name.toLowerCase().slice(0, 4)))
            return known;
    }
    return null;
}
function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
    for (let i = 1; i <= a.length; i++)
        for (let j = 1; j <= b.length; j++)
            dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    return dp[a.length][b.length];
}
// ─── Step 3: Compute splits ───────────────────────────────────────────────────
function computeSplits(expense) {
    const { splitType, splitWith, splitDetails = {}, amount } = expense;
    const splits = {};
    if (splitType === 'equal') {
        const share = Math.round((amount / splitWith.length) * 100) / 100;
        // Handle rounding: give last person the remainder
        let total = 0;
        for (let i = 0; i < splitWith.length - 1; i++) {
            splits[splitWith[i]] = share;
            total += share;
        }
        if (splitWith.length > 0) {
            splits[splitWith[splitWith.length - 1]] = Math.round((amount - total) * 100) / 100;
        }
    }
    else if (splitType === 'unequal') {
        for (const [name, val] of Object.entries(splitDetails)) {
            splits[name] = val;
        }
    }
    else if (splitType === 'percentage') {
        const total = Object.values(splitDetails).reduce((a, b) => a + b, 0);
        for (const [name, pct] of Object.entries(splitDetails)) {
            splits[name] = Math.round((amount * pct / total) * 100) / 100;
        }
    }
    else if (splitType === 'share') {
        const totalShares = Object.values(splitDetails).reduce((a, b) => a + b, 0);
        for (const [name, shares] of Object.entries(splitDetails)) {
            splits[name] = Math.round((amount * shares / totalShares) * 100) / 100;
        }
    }
    return splits;
}
