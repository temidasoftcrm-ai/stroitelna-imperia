-- ПРИЛОЖЕНА в Supabase 25.10.2026 (supabase db query --linked -f, без db push).
-- error_reports — телеметрията на грешките в играта (errtelem.js, feature 'err-telemetry'; праща само със съгласие 'analytics').
-- Прилага се през SQL Editor (f1), НЕ с supabase db push. Може да се пуска повече от веднъж.
--
-- Без лични данни: errtelem.js вече чисти имейли, адреси, параметри, токени и дълги числа; тук се пази само случаен anon id
-- (localStorage 'stroi-errtel-id', не е свързан с акаунта — user_id НЕ се записва), версия, браузър (семейство), град, графика, ден, грешка, стек.
-- Запис само през public.report_errors(p_anon, p) — anon и authenticated; таблицата е затворена (RLS без политики, без права):
-- четат само service_role и таблото (SQL Editor). Таван: 60 реда на час на anon id, 5000 реда на час общо; до 20 грешки на заявка;
-- msg ≤ 300, stack ≤ 1024, at ≤ 120 знака. Повторенията на една грешка се събират в count (n от клиента, до 10 000).

create table if not exists public.error_reports (
  id bigserial primary key,
  ts timestamptz not null default now(),
  anon_id text not null check (anon_id ~ '^[0-9a-f-]{8,40}$'),
  version text check (length(version) <= 20),
  ua text check (length(ua) <= 10),
  city text check (length(city) <= 40),
  gfx text check (length(gfx) <= 20),
  day int,
  msg text not null check (length(msg) <= 300),
  stack text check (length(stack) <= 1024),
  at text check (length(at) <= 120),
  count int not null default 1 check (count between 1 and 10000),
  first_at timestamptz,   -- кога клиентът я видя за първи път (t), до 7 дни назад
  lost int not null default 0 check (lost >= 0)   -- колко различни грешки не са влезли в буфера на клиента (над 20 на сесия)
);
create index if not exists error_reports_anon_ts on public.error_reports (anon_id, ts desc);
create index if not exists error_reports_ts on public.error_reports (ts desc);
create index if not exists error_reports_msg on public.error_reports (version, msg);

alter table public.error_reports enable row level security;   -- без политики: anon/authenticated не виждат и не пишат директно
revoke all on public.error_reports from public, anon, authenticated;
revoke all on sequence public.error_reports_id_seq from public, anon, authenticated;

create or replace function public.report_errors(p_anon text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare e jsonb; n int := 0; mine int; total int; room int; t timestamptz;
  txt constant text := '[[:cntrl:]]';
begin
  if p_anon is null or p_anon !~ '^[0-9a-f-]{8,40}$' then return jsonb_build_object('ok', false, 'err', 'bad_id'); end if;
  if p is null or jsonb_typeof(p) <> 'object' or jsonb_typeof(p -> 'errors') <> 'array' or pg_column_size(p) > 65536 then return jsonb_build_object('ok', false, 'err', 'bad_data'); end if;
  perform pg_advisory_xact_lock(hashtextextended('error_reports:' || p_anon, 0));
  select count(*) into mine from error_reports where anon_id = p_anon and ts > now() - interval '1 hour';
  select count(*) into total from error_reports where ts > now() - interval '1 hour';
  room := least(60 - mine, 5000 - total, 20);
  if room <= 0 then return jsonb_build_object('ok', true, 'saved', 0, 'limited', true); end if;
  for e in select value from jsonb_array_elements(p -> 'errors') limit room loop
    if jsonb_typeof(e) <> 'object' or coalesce(e ->> 'msg', '') = '' then continue; end if;
    t := case when jsonb_typeof(e -> 't') = 'number' and (e ->> 't')::numeric between 1e12 and 1e14 then to_timestamp((e ->> 't')::numeric / 1000) end;
    if t is not null and (t < now() - interval '7 days' or t > now() + interval '1 day') then t := null; end if;
    insert into error_reports (anon_id, version, ua, city, gfx, day, msg, stack, at, count, first_at, lost) values (
      p_anon,
      left(regexp_replace(p ->> 'v', txt, '', 'g'), 20),
      left(regexp_replace(p ->> 'ua', txt, '', 'g'), 10),
      left(regexp_replace(e ->> 'city', txt, '', 'g'), 40),
      left(regexp_replace(e ->> 'gfx', txt, '', 'g'), 20),
      case when jsonb_typeof(e -> 'day') = 'number' and (e ->> 'day')::numeric between 0 and 1e7 then (e ->> 'day')::numeric::int end,
      left(regexp_replace(e ->> 'msg', txt, ' ', 'g'), 300),
      left(e ->> 'stack', 1024),
      left(regexp_replace(e ->> 'at', txt, '', 'g'), 120),
      case when jsonb_typeof(e -> 'n') = 'number' then least(greatest((e ->> 'n')::numeric, 1), 10000)::int else 1 end,
      t,
      case when n = 0 and jsonb_typeof(p -> 'lost') = 'number' then least(greatest((p ->> 'lost')::numeric, 0), 1e6)::int else 0 end);
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'saved', n);
end $$;
revoke all on function public.report_errors(text, jsonb) from public;
grant execute on function public.report_errors(text, jsonb) to anon, authenticated;

-- чистене: 30 дни (pg_cron, ако е включен)
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('error_reports_clean', '23 3 * * *', $c$delete from public.error_reports where ts < now() - interval '30 days'$c$);
  end if;
end $$;

-- преглед (SQL Editor): най-честите за последните 7 дни
--   select version, msg, at, sum(count) n, count(distinct anon_id) players, max(ts) last from public.error_reports
--   where ts > now() - interval '7 days' group by 1, 2, 3 order by n desc limit 50;
