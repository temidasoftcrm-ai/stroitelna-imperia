-- ПРИЛОЖЕНА в TemidaBase 21.11.2026 (стек imperia на станцията: ssh 192.168.1.120 'docker exec -i imperia-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction' < файла). Не с db push.
-- model-stats (lab/features.js, usage.js + config.js): ново събитие 'model' — k: групата 3D модели (папката: lm, air, trains, riot…),
-- n: колко различни файла от групата са заредени в сесията (праща се при нарастване, най-много веднъж на 60 s за група).
-- Без лични данни, същите тавани (50 на заявка, 300 на час на anon id). Може да се пуска повече от веднъж.
--
-- Справка — какъв дял от играчите (със съгласие) е видял всяка група:
--   select k as grupa, count(distinct anon_id) as igrachi,
--          round(100.0 * count(distinct anon_id) / nullif((select count(distinct anon_id) from usage_events where ev = 'model' and ts > now() - interval '30 days'), 0), 1) as procent,
--          max(n) as nai_mnogo_faila
--   from usage_events where ev = 'model' and ts > now() - interval '30 days' group by k order by procent;

alter table public.usage_events drop constraint if exists usage_events_ev_check;
alter table public.usage_events add constraint usage_events_ev_check
  check (ev in ('session', 'play_min', 'level', 'city', 'open', 'tut', 'ad', 'away', 'music', 'model'));

create or replace function public.report_usage(p_anon text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare e jsonb; n int := 0; mine int; total int; room int; ok_ev constant text[] := array['session', 'play_min', 'level', 'city', 'open', 'tut', 'ad', 'away', 'music', 'model'];
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
