begin;

-- 1) Zieltabellen leeren (optional hartes Rebuild aus Snapshot)
delete from public.user_trades;
delete from public.user_asset_meta;
delete from public.user_journal_entries;
delete from public.user_settings;
delete from public.user_ai_knowledge;

-- 2) Trades aus snapshot.trades
insert into public.user_trades (
  user_id,
  trade_id,
  name,
  typ,
  basiswert,
  isin,
  wkn,
  notiz,
  kaufzeitpunkt,
  kauf_preis,
  stueck,
  kauf_stueckpreis,
  kauf_transaktion_manuell,
  kauf_gebuehren,
  kauf_preis_manuell,
  verkaufszeitpunkt,
  verkauf_preis,
  verkauf_stueckpreis,
  verkauf_transaktion_manuell,
  verkauf_steuern,
  verkauf_gebuehren,
  verkauf_preis_manuell,
  gewinn,
  status
)
select
  d.user_id,
  t->>'id' as trade_id,
  t->>'name' as name,
  t->>'typ' as typ,
  t->>'basiswert' as basiswert,
  nullif(t->>'isin', '') as isin,
  nullif(t->>'wkn', '') as wkn,
  nullif(t->>'notiz', '') as notiz,
  t->>'kaufzeitpunkt' as kaufzeitpunkt,
  coalesce((t->>'kaufPreis')::double precision, 0) as kauf_preis,
  nullif(t->>'stueck', '')::double precision as stueck,
  nullif(t->>'kaufStueckpreis', '')::double precision as kauf_stueckpreis,
  nullif(t->>'kaufTransaktionManuell', '')::double precision as kauf_transaktion_manuell,
  nullif(t->>'kaufGebuehren', '')::double precision as kauf_gebuehren,
  nullif(t->>'kaufPreisManuell', '')::double precision as kauf_preis_manuell,
  nullif(t->>'verkaufszeitpunkt', '') as verkaufszeitpunkt,
  nullif(t->>'verkaufPreis', '')::double precision as verkauf_preis,
  nullif(t->>'verkaufStueckpreis', '')::double precision as verkauf_stueckpreis,
  nullif(t->>'verkaufTransaktionManuell', '')::double precision as verkauf_transaktion_manuell,
  nullif(t->>'verkaufSteuern', '')::double precision as verkauf_steuern,
  nullif(t->>'verkaufGebuehren', '')::double precision as verkauf_gebuehren,
  nullif(t->>'verkaufPreisManuell', '')::double precision as verkauf_preis_manuell,
  nullif(t->>'gewinn', '')::double precision as gewinn,
  coalesce(nullif(t->>'status', ''), 'Offen') as status
from public.user_app_data d
cross join lateral jsonb_array_elements(coalesce(d.snapshot->'trades', '[]'::jsonb)) as t
where coalesce(t->>'id', '') <> '';

-- 3) Asset-Meta aus snapshot.assetMeta
insert into public.user_asset_meta (user_id, name, category, ticker, isin, wkn, waehrung)
select
  d.user_id,
  a->>'name' as name,
  nullif(a->>'category', '') as category,
  nullif(a->>'ticker', '') as ticker,
  nullif(a->>'isin', '') as isin,
  nullif(a->>'wkn', '') as wkn,
  nullif(a->>'waehrung', '') as waehrung
from public.user_app_data d
cross join lateral jsonb_array_elements(coalesce(d.snapshot->'assetMeta', '[]'::jsonb)) as a
where coalesce(a->>'name', '') <> ''
on conflict (user_id, name) do update set
  category = excluded.category,
  ticker = excluded.ticker,
  isin = excluded.isin,
  wkn = excluded.wkn,
  waehrung = excluded.waehrung;

-- 4) Journal (byDay/byWeek/byMonth) aus snapshot.journalData
insert into public.user_journal_entries (user_id, scope, entry_key, content)
select d.user_id, 'day', e.key, e.value
from public.user_app_data d
cross join lateral jsonb_each_text(coalesce(d.snapshot->'journalData'->'byDay', '{}'::jsonb)) as e
union all
select d.user_id, 'week', e.key, e.value
from public.user_app_data d
cross join lateral jsonb_each_text(coalesce(d.snapshot->'journalData'->'byWeek', '{}'::jsonb)) as e
union all
select d.user_id, 'month', e.key, e.value
from public.user_app_data d
cross join lateral jsonb_each_text(coalesce(d.snapshot->'journalData'->'byMonth', '{}'::jsonb)) as e
on conflict (user_id, scope, entry_key) do update set
  content = excluded.content;

-- 5) Settings + Theme aus Snapshot
insert into public.user_settings (user_id, settings, theme)
select
  d.user_id,
  coalesce(d.snapshot->'appSettings', '{}'::jsonb) as settings,
  case
    when coalesce(d.snapshot->>'theme', 'dark') = 'light' then 'light'
    else 'dark'
  end as theme
from public.user_app_data d
on conflict (user_id) do update set
  settings = excluded.settings,
  theme = excluded.theme;

-- 6) AI Knowledge aus Snapshot
insert into public.user_ai_knowledge (user_id, content)
select
  d.user_id,
  coalesce(d.snapshot->>'aiKnowledgeBase', '') as content
from public.user_app_data d
on conflict (user_id) do update set
  content = excluded.content;

commit;
