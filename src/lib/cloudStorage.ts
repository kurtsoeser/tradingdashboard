import type { AppSettings } from "../app/settings";
import type { AssetMeta } from "../app/types";
import type { JournalData } from "./journalStorage";
import { supabase } from "./supabaseClient";
import type { Trade } from "../types/trade";

export interface CloudSnapshot {
  trades: Trade[];
  assetMeta: AssetMeta[];
  journalData: JournalData;
  aiKnowledgeBase: string;
  appSettings: AppSettings;
  theme: "dark" | "light";
}

function emptySnapshot(): CloudSnapshot {
  return {
    trades: [],
    assetMeta: [],
    journalData: { byDay: {}, byWeek: {}, byMonth: {} },
    aiKnowledgeBase: "",
    appSettings: {} as AppSettings,
    theme: "dark"
  };
}

function toNullable<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

function fromNullable<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

function toDbTrade(userId: string, trade: Trade) {
  return {
    user_id: userId,
    trade_id: trade.id,
    name: trade.name,
    typ: trade.typ,
    basiswert: trade.basiswert,
    isin: toNullable(trade.isin),
    wkn: toNullable(trade.wkn),
    notiz: toNullable(trade.notiz),
    kaufzeitpunkt: trade.kaufzeitpunkt,
    kauf_preis: trade.kaufPreis,
    stueck: toNullable(trade.stueck),
    kauf_stueckpreis: toNullable(trade.kaufStueckpreis),
    kauf_transaktion_manuell: toNullable(trade.kaufTransaktionManuell),
    kauf_gebuehren: toNullable(trade.kaufGebuehren),
    kauf_preis_manuell: toNullable(trade.kaufPreisManuell),
    verkaufszeitpunkt: toNullable(trade.verkaufszeitpunkt),
    verkauf_preis: toNullable(trade.verkaufPreis),
    verkauf_stueckpreis: toNullable(trade.verkaufStueckpreis),
    verkauf_transaktion_manuell: toNullable(trade.verkaufTransaktionManuell),
    verkauf_steuern: toNullable(trade.verkaufSteuern),
    verkauf_gebuehren: toNullable(trade.verkaufGebuehren),
    verkauf_preis_manuell: toNullable(trade.verkaufPreisManuell),
    gewinn: toNullable(trade.gewinn),
    status: trade.status
  };
}

function fromDbTrade(row: Record<string, unknown>): Trade {
  return {
    id: String(row.trade_id),
    name: String(row.name),
    typ: String(row.typ),
    basiswert: String(row.basiswert),
    isin: fromNullable((row.isin as string | null) ?? null),
    wkn: fromNullable((row.wkn as string | null) ?? null),
    notiz: fromNullable((row.notiz as string | null) ?? null),
    kaufzeitpunkt: String(row.kaufzeitpunkt),
    kaufPreis: Number(row.kauf_preis ?? 0),
    stueck: fromNullable((row.stueck as number | null) ?? null),
    kaufStueckpreis: fromNullable((row.kauf_stueckpreis as number | null) ?? null),
    kaufTransaktionManuell: fromNullable((row.kauf_transaktion_manuell as number | null) ?? null),
    kaufGebuehren: fromNullable((row.kauf_gebuehren as number | null) ?? null),
    kaufPreisManuell: fromNullable((row.kauf_preis_manuell as number | null) ?? null),
    verkaufszeitpunkt: fromNullable((row.verkaufszeitpunkt as string | null) ?? null),
    verkaufPreis: fromNullable((row.verkauf_preis as number | null) ?? null),
    verkaufStueckpreis: fromNullable((row.verkauf_stueckpreis as number | null) ?? null),
    verkaufTransaktionManuell: fromNullable((row.verkauf_transaktion_manuell as number | null) ?? null),
    verkaufSteuern: fromNullable((row.verkauf_steuern as number | null) ?? null),
    verkaufGebuehren: fromNullable((row.verkauf_gebuehren as number | null) ?? null),
    verkaufPreisManuell: fromNullable((row.verkauf_preis_manuell as number | null) ?? null),
    gewinn: fromNullable((row.gewinn as number | null) ?? null),
    status: String(row.status) as Trade["status"]
  };
}

async function loadLegacySnapshot(userId: string): Promise<CloudSnapshot | null> {
  const { data, error } = await supabase!
    .from("user_app_data")
    .select("snapshot")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  if (!data?.snapshot) return null;
  return data.snapshot as CloudSnapshot;
}

export async function loadCloudSnapshot(userId: string): Promise<CloudSnapshot | null> {
  if (!supabase) return null;

  const [tradesRes, assetsRes, journalRes, settingsRes, aiRes] = await Promise.all([
    supabase.from("user_trades").select("*").eq("user_id", userId).order("kaufzeitpunkt", { ascending: false }),
    supabase.from("user_asset_meta").select("*").eq("user_id", userId).order("name", { ascending: true }),
    supabase.from("user_journal_entries").select("*").eq("user_id", userId),
    supabase.from("user_settings").select("settings,theme").eq("user_id", userId).maybeSingle(),
    supabase.from("user_ai_knowledge").select("content").eq("user_id", userId).maybeSingle()
  ]);

  if (tradesRes.error) throw tradesRes.error;
  if (assetsRes.error) throw assetsRes.error;
  if (journalRes.error) throw journalRes.error;
  if (settingsRes.error) throw settingsRes.error;
  if (aiRes.error) throw aiRes.error;

  const hasNormalizedData =
    (tradesRes.data?.length ?? 0) > 0 ||
    (assetsRes.data?.length ?? 0) > 0 ||
    (journalRes.data?.length ?? 0) > 0 ||
    Boolean(settingsRes.data) ||
    Boolean(aiRes.data?.content);

  if (!hasNormalizedData) {
    const legacy = await loadLegacySnapshot(userId);
    if (legacy) {
      await saveCloudSnapshot(userId, legacy);
      return legacy;
    }
    return null;
  }

  const snapshot = emptySnapshot();
  snapshot.trades = (tradesRes.data ?? []).map((row) => fromDbTrade(row as Record<string, unknown>));
  snapshot.assetMeta = (assetsRes.data ?? []).map((row) => ({
    name: String(row.name),
    category: fromNullable((row.category as string | null) ?? null),
    ticker: fromNullable((row.ticker as string | null) ?? null),
    isin: fromNullable((row.isin as string | null) ?? null),
    wkn: fromNullable((row.wkn as string | null) ?? null),
    waehrung: fromNullable((row.waehrung as string | null) ?? null)
  }));
  for (const row of journalRes.data ?? []) {
    const scope = String(row.scope);
    const entryKey = String(row.entry_key);
    const content = String(row.content ?? "");
    if (scope === "day") snapshot.journalData.byDay[entryKey] = content;
    if (scope === "week") snapshot.journalData.byWeek[entryKey] = content;
    if (scope === "month") snapshot.journalData.byMonth[entryKey] = content;
  }
  snapshot.appSettings = ((settingsRes.data?.settings ?? {}) as AppSettings);
  snapshot.theme = settingsRes.data?.theme === "light" ? "light" : "dark";
  snapshot.aiKnowledgeBase = String(aiRes.data?.content ?? "");
  return snapshot;
}

export async function saveCloudSnapshot(userId: string, snapshot: CloudSnapshot): Promise<void> {
  if (!supabase) return;
  const tradesRows = snapshot.trades.map((trade) => toDbTrade(userId, trade));
  const assetRows = snapshot.assetMeta.map((meta) => ({
    user_id: userId,
    name: meta.name,
    category: toNullable(meta.category),
    ticker: toNullable(meta.ticker),
    isin: toNullable(meta.isin),
    wkn: toNullable(meta.wkn),
    waehrung: toNullable(meta.waehrung)
  }));
  const journalRows = [
    ...Object.entries(snapshot.journalData.byDay).map(([entry_key, content]) => ({ user_id: userId, scope: "day", entry_key, content })),
    ...Object.entries(snapshot.journalData.byWeek).map(([entry_key, content]) => ({ user_id: userId, scope: "week", entry_key, content })),
    ...Object.entries(snapshot.journalData.byMonth).map(([entry_key, content]) => ({ user_id: userId, scope: "month", entry_key, content }))
  ];

  const { error: delTradesError } = await supabase.from("user_trades").delete().eq("user_id", userId);
  if (delTradesError) throw delTradesError;
  if (tradesRows.length > 0) {
    const { error } = await supabase.from("user_trades").insert(tradesRows);
    if (error) throw error;
  }

  const { error: delAssetsError } = await supabase.from("user_asset_meta").delete().eq("user_id", userId);
  if (delAssetsError) throw delAssetsError;
  if (assetRows.length > 0) {
    const { error } = await supabase.from("user_asset_meta").insert(assetRows);
    if (error) throw error;
  }

  const { error: delJournalError } = await supabase.from("user_journal_entries").delete().eq("user_id", userId);
  if (delJournalError) throw delJournalError;
  if (journalRows.length > 0) {
    const { error } = await supabase.from("user_journal_entries").insert(journalRows);
    if (error) throw error;
  }

  const { error: settingsError } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      settings: snapshot.appSettings,
      theme: snapshot.theme
    },
    { onConflict: "user_id" }
  );
  if (settingsError) throw settingsError;

  const { error: aiError } = await supabase.from("user_ai_knowledge").upsert(
    {
      user_id: userId,
      content: snapshot.aiKnowledgeBase
    },
    { onConflict: "user_id" }
  );
  if (aiError) throw aiError;
}
