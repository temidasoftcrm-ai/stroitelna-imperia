-- ПРИЛОЖЕНА в Supabase 25.10.2026 (supabase db query --linked -f, без db push).
-- usage_events — анонимната статистика за ползването (usage.js, feature 'usage-stats'; праща САМО със съгласие 'analytics' — consent.js).
-- Прилага се през SQL Editor / supabase db query (f1), НЕ с supabase db push. Може да се пуска повече от веднъж.
--
-- Без лични данни: случаен anon id (localStorage 'stroi-errtel-id' — същият като на грешките при съгласие; не е акаунтът — user_id НЕ се пази),
-- версия, събитие (позволен списък), ключ (напр. „cinema“, „bank:loans“), число, игрален ден, ниво, град. Без имена на фирми, без IP.
-- Запис само през public.report_usage(p_anon, p) — anon и authenticated; таблицата е затворена (RLS без политики, без права) —
-- чете само service_role / таблото / supabase db query. Тавани: до 50 събития на заявка, 300 реда на час на anon id, 20 000 на час общо;
-- ev/k/city ≤ 40 знака. Чистене след 180 дни (pg_cron).
--
-- Събитията (usage.js):
--   session  — начало (k: графиката low/mid/high, n: кадри в секунда след ~15 s)
--   play_min — n минути игра в сесията (10 / 30 / 60 / 120)
--   level    — достигнато ниво (n)
--   city     — смяна на града (k: id на града, n: 1 — нов, 0 — вече твой)
--   open     — отворена функция (k: cinema, board, president, campaign, bank, bank:<таб>, coop, online, и големите прозорци: hw, rail, air, sea, cities…)
--   tut      — урокът (k: step / skip / done, n: стъпка)
--   ad       — реклама (k: next:<статус> / reward:<статус>)
--   away     — „Докато те нямаше“ (k: shown / doubled, n: игрални дни)
--   music    — плъзгачът на музиката на 0 (n: 0)

create table if not exists public.usage_events (
  id bigserial primary key,
  ts timestamptz not null default now(),
  anon_id text not null check (anon_id ~ '^[0-9a-f-]{8,40}$'),
  v text check (length(v) <= 20),
  ev text not null check (ev in ('session', 'play_min', 'level', 'city', 'open', 'tut', 'ad', 'away', 'music')),
  k text check (length(k) <= 40),
  n int,
  day int,
  lv int,
  city text check (length(city) <= 40)
);
create index if not exists usage_events_ts on public.usage_events (ts desc);
create index if not exists usage_events_anon_ts on public.usage_events (anon_id, ts desc);
create index if not exists usage_events_ev_ts on public.usage_events (ev, ts desc);

alter table public.usage_events enable row level security;   -- без политики: anon/authenticated не виждат и не пишат директно
revoke all on public.usage_events from public, anon, authenticated;
revoke all on sequence public.usage_events_id_seq from public, anon, authenticated;

create or replace function public.report_usage(p_anon text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare e jsonb; n int := 0; mine int; total int; room int; ok_ev constant text[] := array['session', 'play_min', 'level', 'city', 'open', 'tut', 'ad', 'away', 'music'];
  cc constant text := '[[:cntrl:]]';
  num constant text := '^-?[0-9]{1,9}$';
begin
  if p_anon is null or p_anon !~ '^[0-9a-f-]{8,40}$' then return jsonb_build_object('ok', false, 'err', 'bad_id'); end if;
  if p is null or jsonb_typeof(p) <> 'object' or jsonb_typeof(p -> 'ev') <> 'array' or pg_column_size(p) > 32768 then return jsonb_build_object('ok', false, 'err', 'bad_data'); end if;
  perform pg_advisory_xact_lock(hashtextextended('usage_events:' || p_anon, 0));
  select count(*) into mine from usage_events where anon_id = p_anon and ts > now() - interval '1 hour';
  select count(*) into total from usage_events where ts > now() - interval '1 hour';
  room := least(300 - mine, 20000 - total, 50);
  if room <= 0 then return jsonb_build_object('ok', true, 'saved', 0, 'limited', true); end if;
  for e in select value from jsonb_array_elements(p -> 'ev') limit 50 loop
    exit when n >= room;
    if jsonb_typeof(e) <> 'object' or not ((e ->> 'ev') = any (ok_ev)) then continue; end if;
    insert into usage_events (anon_id, v, ev, k, n, day, lv, city) values (
      p_anon,
      left(regexp_replace(p ->> 'v', cc, '', 'g'), 20),
      e ->> 'ev',
      left(regexp_replace(e ->> 'k', cc, '', 'g'), 40),
      case when (e ->> 'n') ~ num then (e ->> 'n')::int end,
      case when (e ->> 'day') ~ num then (e ->> 'day')::int end,
      case when (e ->> 'lv') ~ num then (e ->> 'lv')::int end,
      left(regexp_replace(e ->> 'city', cc, '', 'g'), 40));
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'saved', n);
end $$;
revoke all on function public.report_usage(text, jsonb) from public;
grant execute on function public.report_usage(text, jsonb) to anon, authenticated;

-- чистене: 180 дни (pg_cron)
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('usage_events_clean', '41 3 * * *', $c$delete from public.usage_events where ts < now() - interval '180 days'$c$);
  end if;
end $$;
