create table if not exists public.user_trades (
  user_id uuid not null references auth.users (id) on delete cascade,
  trade_id text not null,
  name text not null,
  typ text not null,
  basiswert text not null,
  isin text,
  wkn text,
  notiz text,
  kaufzeitpunkt text not null,
  kauf_preis double precision not null,
  stueck double precision,
  kauf_stueckpreis double precision,
  kauf_transaktion_manuell double precision,
  kauf_gebuehren double precision,
  kauf_preis_manuell double precision,
  verkaufszeitpunkt text,
  verkauf_preis double precision,
  verkauf_stueckpreis double precision,
  verkauf_transaktion_manuell double precision,
  verkauf_steuern double precision,
  verkauf_gebuehren double precision,
  verkauf_preis_manuell double precision,
  gewinn double precision,
  status text not null,
  primary key (user_id, trade_id)
);

create table if not exists public.user_positions (
  user_id uuid not null references auth.users (id) on delete cascade,
  position_id uuid not null default gen_random_uuid(),
  name text not null,
  typ text not null,
  basiswert text not null,
  isin text,
  wkn text,
  notiz text,
  manual_checked boolean not null default false,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, position_id)
);

alter table public.user_positions
  add column if not exists legacy_trade_id text,
  add column if not exists manual_checked boolean not null default false;

create unique index if not exists user_positions_legacy_trade_idx
  on public.user_positions (user_id, legacy_trade_id);

create table if not exists public.user_position_transactions (
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid not null default gen_random_uuid(),
  position_id uuid not null,
  kind text not null check (kind in ('BUY', 'SELL', 'TAX_CORRECTION', 'INCOME')),
  booked_at timestamptz not null default now(),
  qty numeric(20, 8),
  unit_price numeric(20, 8),
  gross_amount numeric(20, 8) not null default 0,
  fees_amount numeric(20, 8) not null default 0,
  tax_amount numeric(20, 8) not null default 0,
  tax_mode text not null default 'AUTO' check (tax_mode in ('AUTO', 'MANUAL')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, transaction_id),
  constraint user_position_transactions_position_fk
    foreign key (user_id, position_id)
    references public.user_positions (user_id, position_id)
    on delete cascade,
  constraint user_position_transactions_qty_nonnegative
    check (qty is null or qty > 0),
  constraint user_position_transactions_unit_price_nonnegative
    check (unit_price is null or unit_price >= 0),
  constraint user_position_transactions_gross_nonnegative
    check (gross_amount >= 0),
  constraint user_position_transactions_fees_nonnegative
    check (fees_amount >= 0),
  constraint user_position_transactions_tax_nonnegative_sell
    check (
      kind <> 'SELL'
      or tax_amount >= 0
    ),
  constraint user_position_transactions_shape_check
    check (
      (kind = 'TAX_CORRECTION' and qty is null and unit_price is null)
      or
      (kind = 'INCOME' and qty is null and unit_price is null)
      or
      (kind in ('BUY', 'SELL') and qty is not null and unit_price is not null)
    )
);

alter table public.user_position_transactions
  add column if not exists legacy_trade_id text,
  add column if not exists legacy_leg text;

create unique index if not exists user_position_transactions_legacy_leg_idx
  on public.user_position_transactions (user_id, legacy_trade_id, legacy_leg);

create table if not exists public.user_asset_meta (
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text,
  ticker text,
  isin text,
  wkn text,
  waehrung text,
  primary key (user_id, name)
);

create table if not exists public.user_journal_entries (
  user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null check (scope in ('day', 'week', 'month')),
  entry_key text not null,
  content text not null default '',
  primary key (user_id, scope, entry_key)
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  updated_at timestamptz not null default now(),
  cloud_data_revision bigint not null default 0,
  cloud_data_revision_at timestamptz
);

alter table public.user_settings
  add column if not exists cloud_data_revision bigint not null default 0,
  add column if not exists cloud_data_revision_at timestamptz;

create table if not exists public.user_ai_knowledge (
  user_id uuid primary key references auth.users (id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now()
);

-- Legacy snapshot storage, remains for migration fallback.
create table if not exists public.user_app_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_settings_updated_at on public.user_settings;
create trigger trg_user_settings_updated_at
before update on public.user_settings
for each row
execute function public.set_updated_at();

drop trigger if exists trg_user_positions_updated_at on public.user_positions;
create trigger trg_user_positions_updated_at
before update on public.user_positions
for each row
execute function public.set_updated_at();

drop trigger if exists trg_user_position_transactions_updated_at on public.user_position_transactions;
create trigger trg_user_position_transactions_updated_at
before update on public.user_position_transactions
for each row
execute function public.set_updated_at();

drop trigger if exists trg_user_ai_knowledge_updated_at on public.user_ai_knowledge;
create trigger trg_user_ai_knowledge_updated_at
before update on public.user_ai_knowledge
for each row
execute function public.set_updated_at();

drop trigger if exists trg_user_app_data_updated_at on public.user_app_data;
create trigger trg_user_app_data_updated_at
before update on public.user_app_data
for each row
execute function public.set_updated_at();

create or replace function public.increment_user_cloud_revision(p_user_id uuid)
returns table(revision bigint, revision_at timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  update public.user_settings s
  set
    cloud_data_revision = coalesce(s.cloud_data_revision, 0) + 1,
    cloud_data_revision_at = now()
  where s.user_id = p_user_id
  returning s.cloud_data_revision, s.cloud_data_revision_at;
end;
$$;

grant execute on function public.increment_user_cloud_revision(uuid) to authenticated;

alter table public.user_trades enable row level security;
alter table public.user_positions enable row level security;
alter table public.user_position_transactions enable row level security;
alter table public.user_asset_meta enable row level security;
alter table public.user_journal_entries enable row level security;
alter table public.user_settings enable row level security;
alter table public.user_ai_knowledge enable row level security;
alter table public.user_app_data enable row level security;

drop policy if exists "Users can read own trades" on public.user_trades;
create policy "Users can read own trades" on public.user_trades for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own trades" on public.user_trades;
create policy "Users can insert own trades" on public.user_trades for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own trades" on public.user_trades;
create policy "Users can update own trades" on public.user_trades for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own trades" on public.user_trades;
create policy "Users can delete own trades" on public.user_trades for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read own positions" on public.user_positions;
create policy "Users can read own positions" on public.user_positions for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own positions" on public.user_positions;
create policy "Users can insert own positions" on public.user_positions for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own positions" on public.user_positions;
create policy "Users can update own positions" on public.user_positions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own positions" on public.user_positions;
create policy "Users can delete own positions" on public.user_positions for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read own position transactions" on public.user_position_transactions;
create policy "Users can read own position transactions" on public.user_position_transactions for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own position transactions" on public.user_position_transactions;
create policy "Users can insert own position transactions" on public.user_position_transactions for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own position transactions" on public.user_position_transactions;
create policy "Users can update own position transactions" on public.user_position_transactions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own position transactions" on public.user_position_transactions;
create policy "Users can delete own position transactions" on public.user_position_transactions for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read own asset meta" on public.user_asset_meta;
create policy "Users can read own asset meta" on public.user_asset_meta for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own asset meta" on public.user_asset_meta;
create policy "Users can insert own asset meta" on public.user_asset_meta for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own asset meta" on public.user_asset_meta;
create policy "Users can update own asset meta" on public.user_asset_meta for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own asset meta" on public.user_asset_meta;
create policy "Users can delete own asset meta" on public.user_asset_meta for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read own journal entries" on public.user_journal_entries;
create policy "Users can read own journal entries" on public.user_journal_entries for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own journal entries" on public.user_journal_entries;
create policy "Users can insert own journal entries" on public.user_journal_entries for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own journal entries" on public.user_journal_entries;
create policy "Users can update own journal entries" on public.user_journal_entries for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own journal entries" on public.user_journal_entries;
create policy "Users can delete own journal entries" on public.user_journal_entries for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read own settings" on public.user_settings;
create policy "Users can read own settings" on public.user_settings for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own settings" on public.user_settings;
create policy "Users can insert own settings" on public.user_settings for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own settings" on public.user_settings;
create policy "Users can update own settings" on public.user_settings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own settings" on public.user_settings;
create policy "Users can delete own settings" on public.user_settings for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read own ai knowledge" on public.user_ai_knowledge;
create policy "Users can read own ai knowledge" on public.user_ai_knowledge for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own ai knowledge" on public.user_ai_knowledge;
create policy "Users can insert own ai knowledge" on public.user_ai_knowledge for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own ai knowledge" on public.user_ai_knowledge;
create policy "Users can update own ai knowledge" on public.user_ai_knowledge for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own ai knowledge" on public.user_ai_knowledge;
create policy "Users can delete own ai knowledge" on public.user_ai_knowledge for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read own app data" on public.user_app_data;
create policy "Users can read own app data" on public.user_app_data for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own app data" on public.user_app_data;
create policy "Users can insert own app data" on public.user_app_data for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own app data" on public.user_app_data;
create policy "Users can update own app data" on public.user_app_data for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own app data" on public.user_app_data;
create policy "Users can delete own app data" on public.user_app_data for delete to authenticated using (auth.uid() = user_id);

-- Backfill v1: user_trades -> user_positions + user_position_transactions
-- Idempotent via legacy_trade_id/legacy_leg indexes.
with eligible_trades as (
  select
    t.*,
    case
      when t.kaufzeitpunkt ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}' then replace(t.kaufzeitpunkt, 'T', ' ')::timestamp
      else now()::timestamp
    end as kaufzeitpunkt_ts,
    case
      when coalesce(t.verkaufszeitpunkt, '') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}' then replace(t.verkaufszeitpunkt, 'T', ' ')::timestamp
      else null
    end as verkaufszeitpunkt_ts
  from public.user_trades t
  where t.typ not in ('Dividende', 'Zinszahlung')
),
inserted_positions as (
  insert into public.user_positions (
    user_id,
    name,
    typ,
    basiswert,
    isin,
    wkn,
    notiz,
    opened_at,
    closed_at,
    status,
    legacy_trade_id
  )
  select
    t.user_id,
    t.name,
    t.typ,
    t.basiswert,
    t.isin,
    t.wkn,
    t.notiz,
    t.kaufzeitpunkt_ts,
    case when t.status = 'Geschlossen' then coalesce(t.verkaufszeitpunkt_ts, t.kaufzeitpunkt_ts) else null end,
    case when t.status = 'Geschlossen' then 'CLOSED' else 'OPEN' end,
    t.trade_id
  from eligible_trades t
  on conflict (user_id, legacy_trade_id) do nothing
  returning user_id, position_id, legacy_trade_id
),
positions_for_backfill as (
  select p.user_id, p.position_id, p.legacy_trade_id
  from public.user_positions p
  where p.legacy_trade_id is not null
),
buy_tx as (
  insert into public.user_position_transactions (
    user_id,
    position_id,
    kind,
    booked_at,
    qty,
    unit_price,
    gross_amount,
    fees_amount,
    tax_amount,
    tax_mode,
    note,
    legacy_trade_id,
    legacy_leg
  )
  select
    t.user_id,
    p.position_id,
    'BUY',
    t.kaufzeitpunkt_ts,
    greatest(coalesce(t.stueck, 1), 0.00000001)::numeric(20, 8),
    (
      case
        when t.kauf_stueckpreis is not null and t.kauf_stueckpreis > 0 then t.kauf_stueckpreis
        when coalesce(t.stueck, 0) > 0 then coalesce(t.kauf_transaktion_manuell, t.kauf_preis, 0) / nullif(t.stueck, 0)
        else coalesce(t.kauf_preis, 0)
      end
    )::numeric(20, 8),
    coalesce(t.kauf_transaktion_manuell, t.kauf_preis, 0)::numeric(20, 8),
    coalesce(t.kauf_gebuehren, 0)::numeric(20, 8),
    0::numeric(20, 8),
    'AUTO',
    'Backfill aus user_trades (BUY)',
    t.trade_id,
    'BUY'
  from eligible_trades t
  join positions_for_backfill p
    on p.user_id = t.user_id
   and p.legacy_trade_id = t.trade_id
  where t.typ <> 'Steuerkorrektur'
  on conflict (user_id, legacy_trade_id, legacy_leg) do nothing
  returning transaction_id
),
sell_tx as (
  insert into public.user_position_transactions (
    user_id,
    position_id,
    kind,
    booked_at,
    qty,
    unit_price,
    gross_amount,
    fees_amount,
    tax_amount,
    tax_mode,
    note,
    legacy_trade_id,
    legacy_leg
  )
  select
    t.user_id,
    p.position_id,
    'SELL',
    coalesce(t.verkaufszeitpunkt_ts, t.kaufzeitpunkt_ts),
    greatest(coalesce(t.stueck, 1), 0.00000001)::numeric(20, 8),
    (
      case
        when t.verkauf_stueckpreis is not null and t.verkauf_stueckpreis > 0 then t.verkauf_stueckpreis
        when coalesce(t.stueck, 0) > 0 then coalesce(t.verkauf_transaktion_manuell, t.verkauf_preis, 0) / nullif(t.stueck, 0)
        else coalesce(t.verkauf_preis, 0)
      end
    )::numeric(20, 8),
    coalesce(t.verkauf_transaktion_manuell, t.verkauf_preis, 0)::numeric(20, 8),
    coalesce(t.verkauf_gebuehren, 0)::numeric(20, 8),
    greatest(coalesce(t.verkauf_steuern, 0), 0)::numeric(20, 8),
    case when t.verkauf_steuern is null then 'AUTO' else 'MANUAL' end,
    'Backfill aus user_trades (SELL)',
    t.trade_id,
    'SELL'
  from eligible_trades t
  join positions_for_backfill p
    on p.user_id = t.user_id
   and p.legacy_trade_id = t.trade_id
  where t.typ <> 'Steuerkorrektur'
    and (
      t.status = 'Geschlossen'
      or t.verkaufszeitpunkt is not null
      or coalesce(t.verkauf_preis, 0) <> 0
      or coalesce(t.gewinn, 0) <> 0
    )
  on conflict (user_id, legacy_trade_id, legacy_leg) do nothing
  returning transaction_id
)
insert into public.user_position_transactions (
  user_id,
  position_id,
  kind,
  booked_at,
  qty,
  unit_price,
  gross_amount,
  fees_amount,
  tax_amount,
  tax_mode,
  note,
  legacy_trade_id,
  legacy_leg
)
select
  t.user_id,
  p.position_id,
  'TAX_CORRECTION',
  t.kaufzeitpunkt_ts,
  null,
  null,
  0::numeric(20, 8),
  0::numeric(20, 8),
  coalesce(t.verkauf_steuern, 0)::numeric(20, 8),
  'MANUAL',
  'Backfill aus user_trades (TAX_CORRECTION)',
  t.trade_id,
  'TAX_CORRECTION'
from eligible_trades t
join positions_for_backfill p
  on p.user_id = t.user_id
 and p.legacy_trade_id = t.trade_id
where t.typ = 'Steuerkorrektur'
on conflict (user_id, legacy_trade_id, legacy_leg) do nothing;

-- -----------------------------------------------------------------------------
-- Migration (bestehende DB): INCOME-Buchungsart für Dividende/Zins
-- In Supabase SQL Editor ausführen, falls die Tabelle schon ohne INCOME angelegt war.
-- -----------------------------------------------------------------------------
alter table public.user_position_transactions drop constraint if exists user_position_transactions_kind_check;
alter table public.user_position_transactions
  add constraint user_position_transactions_kind_check
  check (kind in ('BUY', 'SELL', 'TAX_CORRECTION', 'INCOME'));

alter table public.user_position_transactions drop constraint if exists user_position_transactions_shape_check;
alter table public.user_position_transactions
  add constraint user_position_transactions_shape_check
  check (
    (kind = 'TAX_CORRECTION' and qty is null and unit_price is null)
    or
    (kind = 'INCOME' and qty is null and unit_price is null)
    or
    (kind in ('BUY', 'SELL') and qty is not null and unit_price is not null)
  );
