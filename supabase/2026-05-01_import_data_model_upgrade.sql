-- =============================================================================
-- Import-Datenmodell Upgrade (Trade Republic / N26 / BAWAG)
-- =============================================================================
-- Ziel:
-- 1) Quelle/Broker sauber in Positions- und Tx-Daten modellieren
-- 2) Externe Transaktions-IDs idempotent speichern (Re-Import ohne Duplikate)
-- 3) Broker-Events (z. B. Transfers, Tax Optimization, TILG, Corporate Actions)
--    als eigene Truth-Tabelle erfassen
--
-- Diese Migration ist auf bestehende Umgebungen ausgelegt (idempotent/sicher).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) SOURCE-FELDER auf bestehenden Tabellen
-- -----------------------------------------------------------------------------

alter table public.user_positions
  add column if not exists source_broker text not null default 'MANUAL',
  add column if not exists source_account text;

alter table public.user_position_transactions
  add column if not exists source_broker text not null default 'MANUAL',
  add column if not exists source_account text,
  add column if not exists external_transaction_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_positions_source_broker_check'
  ) then
    alter table public.user_positions
      add constraint user_positions_source_broker_check
      check (source_broker in ('TRADE_REPUBLIC', 'N26', 'BAWAG', 'MANUAL'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_position_transactions_source_broker_check'
  ) then
    alter table public.user_position_transactions
      add constraint user_position_transactions_source_broker_check
      check (source_broker in ('TRADE_REPUBLIC', 'N26', 'BAWAG', 'MANUAL'));
  end if;
end $$;

create unique index if not exists user_position_transactions_external_id_unique
  on public.user_position_transactions (user_id, source_broker, external_transaction_id)
  where external_transaction_id is not null;

-- Optionales Backfill-Heuristik-Update bestehender Legacy-Daten:
-- (Falls du lieber alles als MANUAL lassen willst, einfach auskommentieren)
update public.user_positions
set source_broker = case
  when source_broker <> 'MANUAL' then source_broker
  when coalesce(legacy_trade_id, '') ilike 'bawag-%' then 'BAWAG'
  else 'MANUAL'
end
where source_broker is not null;

update public.user_position_transactions t
set source_broker = coalesce(p.source_broker, 'MANUAL')
from public.user_positions p
where p.user_id = t.user_id
  and p.position_id = t.position_id
  and (t.source_broker is null or t.source_broker = 'MANUAL');

-- Fachliche Zuordnung aus dem aktuellen Bestand:
-- Regeln:
-- 1) BAWAG-Bezug (Name/Basiswert) => BAWAG
-- 2) Aktie mit Kauf vor 2025-01-15 => N26
-- 3) Steuerkorrektur/Long/Short/Fond/Anleihe => Trade Republic
-- Nur "MANUAL" wird überschrieben, bestehende explizite Broker-Zuordnung bleibt erhalten.
update public.user_positions
set source_broker = 'BAWAG'
where source_broker = 'MANUAL'
  and (
    upper(coalesce(name, '')) like '%BAWAG%'
    or upper(coalesce(basiswert, '')) like '%BAWAG%'
  );

update public.user_positions
set source_broker = 'N26'
where source_broker = 'MANUAL'
  and typ = 'Aktie'
  and opened_at < '2025-01-15T00:00:00Z'::timestamptz;

update public.user_positions
set source_broker = 'TRADE_REPUBLIC'
where source_broker = 'MANUAL'
  and typ in ('Steuerkorrektur', 'Long', 'Short', 'Fond', 'Anleihe');

update public.user_position_transactions t
set source_broker = 'TRADE_REPUBLIC'
from public.user_positions p
where p.user_id = t.user_id
  and p.position_id = t.position_id
  and p.source_broker = 'TRADE_REPUBLIC'
  and t.source_broker = 'MANUAL';

update public.user_position_transactions t
set source_broker = 'N26'
from public.user_positions p
where p.user_id = t.user_id
  and p.position_id = t.position_id
  and p.source_broker = 'N26'
  and t.source_broker = 'MANUAL';

update public.user_position_transactions t
set source_broker = 'BAWAG'
from public.user_positions p
where p.user_id = t.user_id
  and p.position_id = t.position_id
  and p.source_broker = 'BAWAG'
  and t.source_broker = 'MANUAL';

-- -----------------------------------------------------------------------------
-- 2) Neue Broker-Event-Tabelle (Single Point of Truth für CSV-Events)
-- -----------------------------------------------------------------------------

create table if not exists public.user_broker_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null default gen_random_uuid(),

  source_broker text not null,
  source_account text,
  external_event_id text not null,      -- z. B. CSV transaction_id

  event_time timestamptz not null,
  event_date date,

  category text not null,               -- TRADING / CASH / CORPORATE_ACTION
  type text not null,                   -- BUY / SELL / TAX_OPTIMIZATION / ...
  asset_class text,

  name text,
  symbol text,                          -- bei TR meist ISIN
  shares numeric(20, 8),
  price numeric(20, 8),
  amount numeric(20, 8),
  fee numeric(20, 8),
  tax numeric(20, 8),
  currency text,
  original_amount numeric(20, 8),
  original_currency text,
  fx_rate numeric(20, 10),

  description text,
  raw_payload jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (user_id, event_id),
  constraint user_broker_events_source_broker_check
    check (source_broker in ('TRADE_REPUBLIC', 'N26', 'BAWAG', 'MANUAL'))
);

create unique index if not exists user_broker_events_external_unique
  on public.user_broker_events (user_id, source_broker, external_event_id);

create index if not exists user_broker_events_time_idx
  on public.user_broker_events (user_id, event_time desc);

drop trigger if exists trg_user_broker_events_updated_at on public.user_broker_events;
create trigger trg_user_broker_events_updated_at
before update on public.user_broker_events
for each row
execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3) RLS + Policies für user_broker_events
-- -----------------------------------------------------------------------------

alter table public.user_broker_events enable row level security;

drop policy if exists "Users can read own broker events" on public.user_broker_events;
create policy "Users can read own broker events"
  on public.user_broker_events
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own broker events" on public.user_broker_events;
create policy "Users can insert own broker events"
  on public.user_broker_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own broker events" on public.user_broker_events;
create policy "Users can update own broker events"
  on public.user_broker_events
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own broker events" on public.user_broker_events;
create policy "Users can delete own broker events"
  on public.user_broker_events
  for delete
  to authenticated
  using (auth.uid() = user_id);

commit;

-- =============================================================================
-- Hinweise für App-Umsetzung nach Migration:
-- - Beim Import zuerst user_broker_events upserten über
--   (user_id, source_broker, external_event_id).
-- - Dann nur source_broker='TRADE_REPUBLIC' in Positions/Tx synchronisieren.
-- - N26/BAWAG/Manual dadurch technisch geschützt.
-- =============================================================================
