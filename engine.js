// KlaimCek engine — pure, dependency-free verification logic.
// Runs identically in the browser (ES module) and in Node (unit tests).
// No network calls, no API keys: every check is computed locally.

// ---------- Indonesian amount parsing ----------
// Handles: "Rp1.250.000", "1.250.000,50", "250rb", "1,5jt", "750 ribu", "Rp 99.000"
export function parseAmountID(raw) {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = String(raw).trim().toLowerCase();
  if (!s) return null;

  let multiplier = 1;
  if (/\b(jt|juta)\b/.test(s) || /jt$/.test(s)) multiplier = 1_000_000;
  else if (/\b(rb|ribu)\b/.test(s) || /rb$/.test(s)) multiplier = 1_000;

  s = s.replace(/rp\.?/g, "").replace(/(jt|juta|rb|ribu)\b/g, "").trim();

  // Indonesian format: '.' = thousands separator, ',' = decimal separator.
  // Plain format "1250000.50" (dot decimal) is also accepted when it does
  // not look like thousands grouping.
  const looksID = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^\d+,\d+$/.test(s);
  if (looksID) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n * multiplier : null;
}

// ---------- Date parsing (ID + ISO) ----------
const MONTHS_ID = {
  jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3, apr: 4, april: 4,
  mei: 5, may: 5, jun: 6, juni: 6, jul: 7, juli: 7, agu: 8, ags: 8, agustus: 8,
  sep: 9, september: 9, okt: 10, oktober: 10, nov: 11, november: 11, des: 12, desember: 12,
};

export function parseDateID(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); // ISO
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/); // dd/mm/yyyy (ID order)
  if (m) {
    let y = +m[3]; if (y < 100) y += 2000;
    return iso(y, +m[2], +m[1]);
  }
  m = s.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/); // 12 Nov 2026 / 12 November 2026
  if (m && MONTHS_ID[m[2]]) return iso(+m[3], MONTHS_ID[m[2]], +m[1]);
  return null;
}
function iso(y, mo, d) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ---------- Merchant normalisation + fuzzy similarity ----------
const NOISE = /\b(pt|cv|ud|tbk|inc|ltd|llc|corp|group|toko|store|shop|outlet|cabang|branch|indonesia|id)\b/g;
export function normalizeMerchant(raw) {
  return String(raw ?? "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

// 0..1 similarity combining edit distance and token overlap.
export function merchantSimilarity(a, b) {
  const x = normalizeMerchant(a), y = normalizeMerchant(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const edit = 1 - levenshtein(x, y) / Math.max(x.length, y.length);
  const tx = new Set(x.split(" ")), ty = new Set(y.split(" "));
  const inter = [...tx].filter((t) => ty.has(t)).length;
  const jaccard = inter / (tx.size + ty.size - inter || 1);
  return Math.max(edit, jaccard);
}

// ---------- Receipt free-text parser ----------
// Extracts merchant (first meaningful line), date and total from pasted
// receipt text (e.g. OCR output or an e-receipt). Deterministic heuristics.
export function parseReceiptText(text) {
  const lines = String(text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let merchant = null, date = null, amount = null;

  for (const line of lines) {
    if (!merchant && /[a-zA-Z]{3,}/.test(line) && !/total|tanggal|date|struk|receipt|invoice|no\.|kasir|cashier/i.test(line)) {
      merchant = line.replace(/\s+/g, " ");
    }
    if (!date) {
      const dm = line.match(/(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})/);
      if (dm) date = parseDateID(dm[1]);
    }
  }
  // Prefer an explicit TOTAL line; otherwise take the largest Rp amount.
  const totalLine = lines.find((l) => /total|grand|bayar|amount/i.test(l) && /[\d.,]/.test(l));
  if (totalLine) {
    const am = totalLine.match(/(?:rp\.?\s*)?[\d][\d.,]*\s*(?:jt|juta|rb|ribu)?/i);
    if (am) amount = parseAmountID(am[0]);
  }
  if (amount == null) {
    const amounts = [...String(text).matchAll(/rp\.?\s*([\d][\d.,]*)/gi)]
      .map((m) => parseAmountID(m[1])).filter((n) => n != null);
    if (amounts.length) amount = Math.max(...amounts);
  }
  return { merchant, date, amount, raw: String(text ?? "") };
}

// ---------- CSV parsing (claims import) ----------
export function parseClaimsCSV(text) {
  const lines = String(text ?? "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const split = (line) => {
    const out = []; let cur = "", q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if ((ch === "," || ch === ";") && !q) { out.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    out.push(cur.trim()); return out;
  };
  const head = split(lines[0]).map((h) => h.toLowerCase());
  const hasHeader = head.some((h) => /employee|karyawan|merchant|toko|amount|nominal|date|tanggal|category|kategori/.test(h));
  const idx = (names, fallback) => {
    const i = head.findIndex((h) => names.some((n) => h.includes(n)));
    return i >= 0 ? i : fallback;
  };
  const cEmp = idx(["employee", "karyawan", "name", "nama"], 0);
  const cDate = idx(["date", "tanggal"], 1);
  const cMer = idx(["merchant", "toko", "vendor"], 2);
  const cAmt = idx(["amount", "nominal", "total"], 3);
  const cCat = idx(["category", "kategori"], 4);

  return lines.slice(hasHeader ? 1 : 0).map((line, i) => {
    const c = split(line);
    return {
      id: `C${i + 1}`,
      employee: c[cEmp] ?? "",
      date: parseDateID(c[cDate]) ?? (c[cDate] || null),
      merchant: c[cMer] ?? "",
      amount: parseAmountID(c[cAmt]),
      category: c[cCat] ?? "",
    };
  }).filter((r) => r.employee || r.merchant || r.amount != null);
}

// ---------- Fingerprint + duplicate detection ----------
export function fingerprint(rec) {
  return `${normalizeMerchant(rec.merchant)}|${rec.date ?? ""}|${rec.amount ?? ""}`;
}

// Groups claims that share the same merchant+date+amount (exact duplicates),
// plus near-duplicates: same employee+amount within ±1 day, merchant ≥0.8 similar.
export function findDuplicates(claims) {
  const dupOf = new Map(); // claimId -> first claimId
  const seen = new Map();
  for (const c of claims) {
    const fp = fingerprint(c);
    if (seen.has(fp)) dupOf.set(c.id, seen.get(fp));
    else seen.set(fp, c.id);
  }
  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const a = claims[i], b = claims[j];
      if (dupOf.has(b.id)) continue;
      if (a.employee && a.employee === b.employee && a.amount != null && a.amount === b.amount &&
          merchantSimilarity(a.merchant, b.merchant) >= 0.8 && daysApart(a.date, b.date) <= 1) {
        dupOf.set(b.id, a.id);
      }
    }
  }
  return dupOf;
}
function daysApart(d1, d2) {
  if (!d1 || !d2) return 999;
  return Math.abs((Date.parse(d1) - Date.parse(d2)) / 86400000);
}

// ---------- Anomaly signals (median / MAD outlier, round numbers, weekends) ----------
export function anomalySignals(claims) {
  const amounts = claims.map((c) => c.amount).filter((n) => n != null).sort((a, b) => a - b);
  const median = amounts.length ? amounts[Math.floor(amounts.length / 2)] : null;
  const mad = amounts.length
    ? amounts.map((n) => Math.abs(n - median)).sort((a, b) => a - b)[Math.floor(amounts.length / 2)]
    : null;
  const out = new Map();
  for (const c of claims) {
    const flags = [];
    if (c.amount != null && median && mad > 0) {
      const z = (0.6745 * (c.amount - median)) / mad; // modified z-score
      if (z > 3.5) flags.push(`Amount is a statistical outlier (modified z-score ${z.toFixed(1)} vs median Rp${fmt(median)})`);
    }
    if (c.amount != null && c.amount >= 100000 && c.amount % 100000 === 0)
      flags.push("Suspiciously round amount (exact multiple of Rp100.000)");
    if (c.date) {
      const day = new Date(c.date + "T00:00:00Z").getUTCDay();
      if (day === 0 || day === 6) flags.push("Dated on a weekend — verify it was a working expense");
    }
    if (flags.length) out.set(c.id, flags);
  }
  return out;
}
export function fmt(n) { return Number(n).toLocaleString("id-ID"); }

// ---------- Main verification ----------
// status: "verified" (green) | "review" (yellow) | "flagged" (red)
// The engine NEVER auto-rejects: a human stays the final approver.
export function verifyClaims(claims, receipts, opts = {}) {
  const amountTol = opts.amountTolerance ?? 0.01; // 1%
  const merchantMin = opts.merchantMinSimilarity ?? 0.6;
  const dupOf = findDuplicates(claims);
  const anomalies = anomalySignals(claims);
  const usedReceipts = new Set();

  return claims.map((c) => {
    const reasons = [];
    let score = 0; // risk score 0..100

    // Best receipt match: same/near date, amount within tolerance, merchant similar.
    let best = null, bestScore = -1;
    receipts.forEach((r, ri) => {
      if (usedReceipts.has(ri)) return;
      let s = 0;
      if (c.amount != null && r.amount != null) {
        const rel = Math.abs(c.amount - r.amount) / Math.max(c.amount, r.amount);
        if (rel <= amountTol) s += 50; else if (rel <= 0.05) s += 25;
      }
      s += merchantSimilarity(c.merchant, r.merchant) * 30;
      if (c.date && r.date && daysApart(c.date, r.date) === 0) s += 20;
      else if (c.date && r.date && daysApart(c.date, r.date) <= 1) s += 10;
      if (s > bestScore) { bestScore = s; best = { receipt: r, index: ri }; }
    });

    if (best && bestScore >= 50) {
      usedReceipts.add(best.index);
      const r = best.receipt;
      if (c.amount != null && r.amount != null && Math.abs(c.amount - r.amount) > Math.max(c.amount, r.amount) * amountTol) {
        reasons.push(`Amount mismatch: claim Rp${fmt(c.amount)} vs receipt Rp${fmt(r.amount)}`);
        score += 45;
      }
      const sim = merchantSimilarity(c.merchant, r.merchant);
      if (sim < merchantMin) { reasons.push(`Merchant mismatch: "${c.merchant}" vs receipt "${r.merchant ?? "?"}" (similarity ${sim.toFixed(2)})`); score += 30; }
      if (c.date && r.date && daysApart(c.date, r.date) > 1) { reasons.push(`Date mismatch: claim ${c.date} vs receipt ${r.date}`); score += 25; }
      if (!reasons.length) reasons.push("Receipt matched: merchant, date and amount all consistent");
    } else {
      reasons.push("No matching receipt found for this claim");
      score += 55;
    }

    if (dupOf.has(c.id)) { reasons.push(`Possible duplicate of claim ${dupOf.get(c.id)} (same merchant/date/amount)`); score += 60; }
    for (const f of anomalies.get(c.id) ?? []) { reasons.push(f); score += 15; }
    if (c.amount == null) { reasons.push("Amount could not be parsed — check the input format"); score += 20; }

    score = Math.min(100, score);
    const status = score >= 50 ? "flagged" : score >= 20 ? "review" : "verified";
    return { ...c, status, riskScore: score, reasons, matchedReceipt: best && bestScore >= 50 ? best.receipt : null };
  });
}

export function summarize(results) {
  const s = { total: results.length, verified: 0, review: 0, flagged: 0, totalAmount: 0, flaggedAmount: 0 };
  for (const r of results) {
    s[r.status]++;
    if (r.amount != null) { s.totalAmount += r.amount; if (r.status === "flagged") s.flaggedAmount += r.amount; }
  }
  return s;
}

export function resultsToCSV(results) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = "id,employee,date,merchant,amount,category,status,risk_score,reasons";
  const rows = results.map((r) => [r.id, r.employee, r.date, r.merchant, r.amount, r.category, r.status, r.riskScore, r.reasons.join(" | ")].map(esc).join(","));
  return [head, ...rows].join("\n");
}
