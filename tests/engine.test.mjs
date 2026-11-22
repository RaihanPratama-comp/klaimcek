import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseAmountID, parseDateID, normalizeMerchant, merchantSimilarity,
  parseReceiptText, parseClaimsCSV, verifyClaims, summarize, resultsToCSV,
} from "../engine.js";
import { SAMPLE_CLAIMS_CSV, SAMPLE_RECEIPTS } from "../samples.js";

test("parseAmountID: Indonesian formats", () => {
  assert.equal(parseAmountID("Rp1.250.000"), 1250000);
  assert.equal(parseAmountID("Rp 87.500"), 87500);
  assert.equal(parseAmountID("1.250.000,50"), 1250000.5);
  assert.equal(parseAmountID("250rb"), 250000);
  assert.equal(parseAmountID("1,5jt"), 1500000);
  assert.equal(parseAmountID("750 ribu"), 750000);
  assert.equal(parseAmountID("42000"), 42000);
  assert.equal(parseAmountID(""), null);
  assert.equal(parseAmountID("abc"), null);
});

test("parseDateID: ID + ISO formats", () => {
  assert.equal(parseDateID("2026-11-03"), "2026-11-03");
  assert.equal(parseDateID("03/11/2026"), "2026-11-03");
  assert.equal(parseDateID("3-11-2026"), "2026-11-03");
  assert.equal(parseDateID("12 Nov 2026"), "2026-11-12");
  assert.equal(parseDateID("5 Desember 2026"), "2026-12-05");
  assert.equal(parseDateID("bukan tanggal"), null);
});

test("merchantSimilarity: fuzzy names", () => {
  assert.equal(normalizeMerchant("PT Indomaret Tbk"), "indomaret");
  assert.ok(merchantSimilarity("Indomaret", "Indomart") > 0.8);
  assert.ok(merchantSimilarity("Grab", "Blue Bird") < 0.4);
  assert.equal(merchantSimilarity("Tokopedia", "TOKOPEDIA"), 1);
});

test("parseReceiptText: extracts merchant/date/total", () => {
  const r = parseReceiptText("INDOMARET\nJl. Merdeka\n03/11/2026 09:12\nTOTAL Rp 87.500");
  assert.equal(r.merchant, "INDOMARET");
  assert.equal(r.date, "2026-11-03");
  assert.equal(r.amount, 87500);
});

test("parseClaimsCSV: quoted Indonesian amounts", () => {
  const claims = parseClaimsCSV(SAMPLE_CLAIMS_CSV);
  assert.equal(claims.length, 8);
  assert.equal(claims[0].amount, 87500);
  assert.equal(claims[3].amount, 1250000);
  assert.equal(claims[0].date, "2026-11-03");
});

test("verifyClaims: demo dataset flags duplicate, mismatch, missing receipt", () => {
  const claims = parseClaimsCSV(SAMPLE_CLAIMS_CSV);
  const receipts = SAMPLE_RECEIPTS.map(parseReceiptText);
  const results = verifyClaims(claims, receipts);
  const byId = Object.fromEntries(results.map((r) => [r.id, r]));

  assert.equal(byId.C1.status, "verified"); // clean match
  assert.equal(byId.C2.status, "flagged");  // exact duplicate of C1
  assert.match(byId.C2.reasons.join(" "), /duplicate/i);
  assert.equal(byId.C3.status, "verified"); // Grab matches
  assert.notEqual(byId.C4.status, "verified"); // Tokopedia amount mismatch 1.250.000 vs 1.050.000
  assert.match(byId.C4.reasons.join(" "), /Amount mismatch/);
  assert.equal(byId.C5.status, "verified"); // Warung Bu Tini matches
  assert.equal(byId.C6.status, "flagged");  // Shell: no receipt
  assert.match(byId.C6.reasons.join(" "), /No matching receipt/);
  assert.equal(byId.C7.status, "verified"); // Blue Bird matches
  assert.equal(byId.C8.status, "verified"); // Adobe matches

  const s = summarize(results);
  assert.equal(s.total, 8);
  assert.ok(s.flagged >= 2);
  assert.ok(resultsToCSV(results).includes("risk_score"));
});

test("verifyClaims: empty receipts flags everything, never crashes", () => {
  const claims = parseClaimsCSV("employee,date,merchant,amount\nX,2026-01-01,Shop,10000");
  const [r] = verifyClaims(claims, []);
  assert.equal(r.status, "flagged");
  assert.ok(r.riskScore >= 50);
});
