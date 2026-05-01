-- Manueller Prüfstatus direkt auf Positionsebene persistieren
-- (statt nur in user_settings.settings.manualCheckedTradeIds).

alter table public.user_positions
  add column if not exists manual_checked boolean not null default false;

-- Einmalige Übernahme alter Checkmarks aus user_settings.settings.manualCheckedTradeIds.
update public.user_positions p
set manual_checked = true
from public.user_settings s
where s.user_id = p.user_id
  and p.legacy_trade_id is not null
  and jsonb_typeof(s.settings -> 'manualCheckedTradeIds') = 'array'
  and exists (
    select 1
    from jsonb_array_elements_text(s.settings -> 'manualCheckedTradeIds') as legacy_id(value)
    where legacy_id.value = p.legacy_trade_id
  );
