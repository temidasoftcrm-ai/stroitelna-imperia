-- Строителна империя — снимката на играта за партньора
-- (поправка 30.10.2026):
-- в дълга игра (100+ града, голям флот) снимката
-- минава 60 000 знака и сървърът я отказва →
-- партньорът не вижда прогреса ти. Таванът става 400 000.
create or replace function public.coop_snap(p_data jsonb)
returns jsonb language plpgsql security definer
set search_path = coop, public as $$
declare u uuid := coop.me();
begin
  if p_data is null
     or jsonb_typeof(p_data) <> 'object'
     or length(p_data::text) > 400000 then
    return coop.fail('bad_snap', 'Невалидна снимка.');
  end if;
  insert into coop.snaps (user_id, data, at)
    values (u, p_data, now())
    on conflict (user_id)
    do update set data = excluded.data, at = now();
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.coop_snap(jsonb) from public, anon;
grant execute on function public.coop_snap(jsonb) to authenticated;
