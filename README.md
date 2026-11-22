# KlaimCek — AI Receipt & Claim Verifier

**Catch fake expense claims before they cost you.**

KlaimCek cross-checks employee expense claims against receipts and flags duplicates, amount mismatches and statistical anomalies — each with a plain-language reason and a 0–100 risk score. It runs **100% offline in the browser**: no uploads, no API keys, no server. Financial data never leaves the user's device, and a human always makes the final approval decision (the AI never auto-rejects).

Built for **SLAY HACKS 2026** (Devpost) — theme: AI for real-world problems.

## Why it exists

Small businesses and Indonesian MSMEs lose money to duplicated or inflated reimbursement claims because manual verification is slow and inconsistent. KlaimCek turns a pile of claims + receipts into a ranked, explainable review list in seconds.

## Features

- **Claim import** — paste or upload CSV (`employee, date, merchant, amount, category`); Indonesian headers and formats supported (`Rp1.250.000`, `250rb`, `1,5jt`, `dd/mm/yyyy`, `12 Nov 2026`).
- **Receipt understanding** — paste receipt text (typed, e-receipt copy, or OCR output); merchant, date and total are extracted automatically and shown as chips for confirmation.
- **Fuzzy receipt matching** — Levenshtein edit distance + token overlap link claims to receipts even with typos ("Indomart" ≈ "Indomaret").
- **Duplicate detection** — exact fingerprints (merchant+date+amount) and near-duplicates (same employee & amount within one day).
- **Anomaly detection** — median/MAD modified z-scores flag statistical outliers; round-number and weekend signals add context.
- **Explainable risk scoring** — every result is `verified` / `needs review` / `flagged` with a 0–100 risk score and human-readable reasons.
- **Exports** — download results as CSV or JSON for the approver/treasurer.
- **Demo mode** — one click loads a sample dataset containing a duplicate, an amount mismatch and a missing receipt.

## How the AI works

| Component | Technique |
|---|---|
| Receipt parsing | Deterministic NLP heuristics tuned for Indonesian receipts (TOTAL-line preference, date/amount grammars) |
| Claim↔receipt matching | Levenshtein distance + Jaccard token overlap, weighted with date/amount agreement |
| Duplicate detection | Normalized fingerprinting + near-duplicate similarity search |
| Anomaly detection | Robust statistics: median & MAD modified z-score (resistant to outliers) |
| Decision layer | Transparent rule-based risk scoring — every point is traceable to a stated reason |

Responsible-AI choices: fully offline (privacy by design), no black-box verdicts, no automatic rejection — KlaimCek ranks and explains; humans decide.

## Run it

No build step, no dependencies. Any static file server works:

```bash
# Option A — Python
python3 -m http.server 8000
# then open http://localhost:8000/?demo=1

# Option B — Node
npx serve .
```

Opening `index.html` directly also works in most browsers (ES modules require a server in some browsers — Option A is safest).

## Test it

```bash
node --test tests/engine.test.mjs
```

7 tests cover Indonesian amount/date parsing, fuzzy merchant similarity, receipt extraction, CSV import, and the full verification pipeline on the demo dataset (duplicate + mismatch + missing-receipt detection).

## Project structure

```
index.html      UI shell
styles.css      styling (dark, responsive)
app.js          UI wiring (import, verify, filter, export)
engine.js       pure verification engine (browser + Node, no deps)
samples.js      built-in demo dataset
tests/          node:test unit tests for engine.js
```

## Limitations (honest scope)

- Receipt input is text (paste/OCR output); built-in photo OCR is out of scope for this hackathon build.
- Amounts/dates follow Indonesian + ISO conventions; other locales may need parser tweaks.
- Risk thresholds are sensible defaults, tunable in `verifyClaims()` options.

## License

MIT
