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

export async function loadCloudSnapshot(userId: string): Promise<CloudSnapshot | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("user_app_data")
    .select("snapshot")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.snapshot) return null;
  return data.snapshot as CloudSnapshot;
}

export async function saveCloudSnapshot(userId: string, snapshot: CloudSnapshot): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("user_app_data").upsert(
    {
      user_id: userId,
      snapshot
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}
