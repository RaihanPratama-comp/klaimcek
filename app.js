import { parseClaimsCSV, parseReceiptText, verifyClaims, summarize, resultsToCSV, fmt } from "./engine.js";
import { SAMPLE_CLAIMS_CSV, SAMPLE_RECEIPTS } from "./samples.js";

const $ = (id) => document.getElementById(id);
const claimsInput = $("claimsInput"), receiptsInput = $("receiptsInput");
let lastResults = [], activeFilter = "all";

function splitReceipts(text) {
  return text.split(/^\s*-{3,}\s*$/m).map((t) => t.trim()).filter(Boolean);
}

function renderParsedReceipts() {
  const box = $("parsedReceipts");
  const receipts = splitReceipts(receiptsInput.value).map(parseReceiptText);
  box.innerHTML = receipts.map((r) =>
    `<span class="rchip"><b>${esc(r.merchant ?? "?")}</b> · ${r.date ?? "no date"} · ${r.amount != null ? "Rp" + fmt(r.amount) : "no amount"}</span>`
  ).join("");
  return receipts;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function runVerify() {
  const claims = parseClaimsCSV(claimsInput.value);
  const receipts = renderParsedReceipts();
  if (!claims.length) { $("runStatus").textContent = "Add at least one claim first (or load the demo data)."; return; }
  lastResults = verifyClaims(claims, receipts);
  const s = summarize(lastResults);
  $("runStatus").textContent = `Checked ${s.total} claims against ${receipts.length} receipts.`;
  $("stats").innerHTML = [
    [s.total, "claims checked"], [s.verified, "verified"], [s.review, "needs review"],
    [s.flagged, "flagged"], ["Rp" + fmt(s.totalAmount), "total claimed"], ["Rp" + fmt(s.flaggedAmount), "flagged value"],
  ].map(([n, l]) => `<div class="stat"><div class="num">${n}</div><div class="lbl">${l}</div></div>`).join("");
  $("resultsSection").classList.remove("hidden");
  renderTable();
  $("resultsSection").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderTable() {
  const rows = lastResults.filter((r) => activeFilter === "all" || r.status === activeFilter);
  $("resultsBody").innerHTML = rows.map((r) => `<tr>
    <td>${r.id}</td><td>${esc(r.employee)}</td><td>${r.date ?? "—"}</td><td>${esc(r.merchant)}</td>
    <td>${r.amount != null ? "Rp" + fmt(r.amount) : "—"}</td>
    <td><span class="pill ${r.status}">${r.status === "review" ? "needs review" : r.status}</span></td>
    <td class="risk">${r.riskScore}</td>
    <td><ul class="reasons">${r.reasons.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></td>
  </tr>`).join("") || `<tr><td colspan="8">No claims in this category.</td></tr>`;
}

function download(name, content, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

$("btnSample").addEventListener("click", () => {
  claimsInput.value = SAMPLE_CLAIMS_CSV;
  receiptsInput.value = SAMPLE_RECEIPTS.join("\n---\n");
  renderParsedReceipts();
  runVerify();
});
$("btnVerify").addEventListener("click", runVerify);
$("btnAddReceipt").addEventListener("click", () => {
  receiptsInput.value = (receiptsInput.value.trim() ? receiptsInput.value.trimEnd() + "\n---\n" : "");
  receiptsInput.focus();
});
receiptsInput.addEventListener("input", renderParsedReceipts);
$("fileCsv").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  claimsInput.value = await f.text();
});
document.querySelectorAll(".chip[data-f]").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".chip[data-f]").forEach((x) => x.classList.remove("active"));
  b.classList.add("active"); activeFilter = b.dataset.f; renderTable();
}));
$("btnExportCsv").addEventListener("click", () => download("klaimcek-results.csv", resultsToCSV(lastResults), "text/csv"));
$("btnExportJson").addEventListener("click", () => download("klaimcek-results.json", JSON.stringify(lastResults, null, 2), "application/json"));

// Deep-link for demos/screenshots: ?demo=1 auto-loads sample data and verifies.
if (new URLSearchParams(location.search).has("demo")) $("btnSample").click();
