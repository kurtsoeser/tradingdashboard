-- Legacy: Tabelle public.user_trades — die App nutzt sie nicht mehr (nur user_positions / user_position_transactions).
-- Nach Deploy der aktuellen App-Version im Supabase SQL Editor ausführen, wenn die Tabelle leer oder obsolet ist.
-- VORHER: Backup / Export, falls du die Daten noch brauchst.

drop table if exists public.user_trades cascade;
