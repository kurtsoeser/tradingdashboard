/** Trade-Republic-CSV-Rohereignisse (früher user_broker_events in Supabase). */
export interface StoredBrokerEvent {
  source_broker: string;
  source_account: string | null;
  external_event_id: string;
  event_time: string;
  event_date: string | null;
  category: string;
  type: string;
  asset_class: string | null;
  name: string | null;
  symbol: string | null;
  shares: number | null;
  price: number | null;
  amount: number | null;
  fee: number | null;
  tax: number | null;
  currency: string | null;
  original_amount: number | null;
  original_currency: string | null;
  fx_rate: number | null;
  description: string | null;
  raw_payload: Record<string, string>;
}

const STORAGE_KEY = "trading-dashboard.broker-events.v1";

function eventKey(row: StoredBrokerEvent): string {
  return `${row.source_broker}::${row.external_event_id}`;
}

export function loadBrokerEventsFromStorage(): StoredBrokerEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredBrokerEvent[]) : [];
  } catch {
    return [];
  }
}

/** Idempotent wie früheres Supabase-Upsert (Konflikt: source_broker + external_event_id). */
export function upsertBrokerEventsToStorage(incoming: StoredBrokerEvent[]): void {
  if (incoming.length === 0) return;
  const byKey = new Map<string, StoredBrokerEvent>();
  for (const row of loadBrokerEventsFromStorage()) {
    byKey.set(eventKey(row), row);
  }
  for (const row of incoming) {
    byKey.set(eventKey(row), row);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...byKey.values()]));
}
