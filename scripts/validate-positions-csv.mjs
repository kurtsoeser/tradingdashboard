import fs from "fs";

const txPath = process.argv[2] || "C:/Users/KurtSöser/Downloads/user_position_transactions_rows.csv";
const posPath = process.argv[3] || "C:/Users/KurtSöser/Downloads/user_positions_rows.csv";

function parseCsv(path) {
  const text = fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.trim().split("\n");
  const header = lines[0].split(",");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const out = [];
    let cur = "";
    let q = false;
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') {
        q = !q;
        continue;
      }
      if (!q && c === ",") {
        out.push(cur);
        cur = "";
        continue;
      }
      cur += c;
    }
    out.push(cur);
    const o = {};
    header.forEach((h, idx) => {
      o[h] = out[idx] ?? "";
    });
    rows.push(o);
  }
  return rows;
}

const tx = parseCsv(txPath);
const pos = parseCsv(posPath);
const posIds = new Set(pos.map((r) => r.position_id));

let orphanTx = 0;
for (const t of tx) {
  if (!posIds.has(t.position_id)) orphanTx++;
}

const byPos = new Map();
for (const t of tx) {
  const k = t.position_id;
  if (!byPos.has(k)) byPos.set(k, []);
  byPos.get(k).push(t);
}

const kinds = { BUY: 0, SELL: 0, TAX_CORRECTION: 0 };
for (const t of tx) {
  kinds[t.kind] = (kinds[t.kind] || 0) + 1;
}

const legKey = new Map();
let dupLeg = 0;
for (const t of tx) {
  if (!t.legacy_trade_id || !t.legacy_leg) continue;
  const k = `${t.user_id}\t${t.legacy_trade_id}\t${t.legacy_leg}`;
  if (legKey.has(k)) dupLeg++;
  else legKey.set(k, t.transaction_id);
}

let posNoTx = 0;
for (const p of pos) {
  const list = byPos.get(p.position_id) || [];
  if (list.length === 0) posNoTx++;
}

let openNoBuy = 0;
let closedNoBuy = 0;
let closedNoSell = 0;
for (const p of pos) {
  const list = byPos.get(p.position_id) || [];
  const hasBuy = list.some((x) => x.kind === "BUY");
  const hasSell = list.some((x) => x.kind === "SELL");
  if (p.status === "OPEN" && !hasBuy) openNoBuy++;
  if (p.status === "CLOSED" && p.typ !== "Steuerkorrektur") {
    if (!hasBuy) closedNoBuy++;
    if (!hasSell) closedNoSell++;
  }
}

const syncPat = /2026-04-30 20:40:47/;
let posSuspiciousOpen = 0;
for (const p of pos) {
  if (syncPat.test(p.opened_at)) posSuspiciousOpen++;
}
let txSuspiciousBook = 0;
for (const t of tx) {
  if (syncPat.test(t.booked_at)) txSuspiciousBook++;
}

// legacy_trade_id on tx should match position's legacy when both set
let legacyMismatch = 0;
for (const t of tx) {
  const p = pos.find((row) => row.position_id === t.position_id);
  if (!p || !t.legacy_trade_id || !p.legacy_trade_id) continue;
  if (t.legacy_trade_id !== p.legacy_trade_id) legacyMismatch++;
}

const withTx = new Set(tx.map((t) => t.position_id));
const positionsWithoutTx = pos.filter((p) => !withTx.has(p.position_id));
const syncStampPositions = pos.filter((p) => syncPat.test(p.opened_at));

console.log(JSON.stringify({
  positions: pos.length,
  transactions: tx.length,
  kinds,
  orphanTx,
  dupLeg,
  posNoTx,
  openNoBuy,
  closedNoBuy,
  closedNoSell,
  posOpenedAtSyncStamp: posSuspiciousOpen,
  txBookedAtSyncStamp: txSuspiciousBook,
  legacyTxVsPositionMismatch: legacyMismatch,
  positionsWithoutTx: positionsWithoutTx.map((p) => ({
    legacy_trade_id: p.legacy_trade_id,
    name: p.name,
    typ: p.typ,
    status: p.status
  })),
  syncStampOpenSample: syncStampPositions.map((p) => ({
    legacy_trade_id: p.legacy_trade_id,
    name: p.name,
    opened_at: p.opened_at,
    closed_at: p.closed_at
  }))
}, null, 2));
