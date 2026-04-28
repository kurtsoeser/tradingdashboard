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
  updated_at timestamptz not null default now()
);

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

alter table public.user_trades enable row level security;
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
