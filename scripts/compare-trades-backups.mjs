/**
 * Vergleicht zwei Trade-Listen aus JSON-Backups (Einstellungen → Export).
 *
 * Usage:
 *   node scripts/compare-trades-backups.mjs <referenz.json> <aktuell.json>
 *
 * Referenz = deine als „wahr“ geltende Datei (älterer Export oder bewusster Stand).
 * Aktuell    = frischer Export aus der App nach dem fraglichen Sync.
 */

import fs from "node:fs";
import path from "node:path";

const [, , refPath, curPath] = process.argv;

if (!refPath || !curPath) {
  console.error("Usage: node scripts/compare-trades-backups.mjs <referenz.json> <aktuell.json>");
  process.exit(1);
}

function loadTrades(filePath) {
  const raw = JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
  const arr = Array.isArray(raw) ? raw : raw.trades ?? raw.data;
  if (!Array.isArray(arr)) {
    throw new Error(`${filePath}: Kein trades-Array gefunden (erwartet Backup v2 oder Trade-Array).`);
  }
  return arr;
}

function byId(trades) {
  const m = new Map();
  for (const t of trades) {
    const id = t?.id ?? t?.tradeId;
    if (id) m.set(String(id), t);
  }
  return m;
}

const ref = loadTrades(refPath);
const cur = loadTrades(curPath);
const refMap = byId(ref);
const curMap = byId(cur);

const fields = [
  ["name", "name"],
  ["typ", "typ"],
  ["basiswert", "basiswert"],
  ["kaufzeitpunkt", "kaufzeitpunkt"],
  ["verkaufszeitpunkt", "verkaufszeitpunkt"],
  ["status", "status"],
  ["kaufPreis", "kaufPreis"],
  ["verkaufPreis", "verkaufPreis"]
];

let mismatch = 0;
let ok = 0;

for (const [id, a] of refMap) {
  const b = curMap.get(id);
  if (!b) {
    console.log(`FEHLT in aktuell: ${id} | ${a.name ?? ""}`);
    mismatch++;
    continue;
  }
  const diffs = [];
  for (const [k] of fields) {
    const va = a[k];
    const vb = b[k];
    const sa = va === undefined || va === null ? "" : String(va);
    const sb = vb === undefined || vb === null ? "" : String(vb);
    if (sa !== sb) diffs.push(`${k}: "${sa}" → "${sb}"`);
  }
  if (diffs.length) {
    console.log(`UNTERSCHIED ${id} | ${a.name ?? ""}`);
    diffs.forEach((d) => console.log(`   ${d}`));
    mismatch++;
  } else {
    ok++;
  }
}

for (const [id, b] of curMap) {
  if (!refMap.has(id)) {
    console.log(`NEU in aktuell (nicht in Referenz): ${id} | ${b.name ?? ""}`);
    mismatch++;
  }
}

console.log("\n--- Zusammenfassung ---");
console.log(`Referenz-Trades: ${refMap.size}`);
console.log(`Aktuell-Trades:  ${curMap.size}`);
console.log(`Übereinstimmend: ${ok}`);
console.log(`Abweichungen:    ${mismatch}`);
