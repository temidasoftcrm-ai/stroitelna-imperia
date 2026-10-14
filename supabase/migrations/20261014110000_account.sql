-- ⚙️ Настройки: изтриване на облачните записи и на целия акаунт (само собствените — по auth.uid()).
-- Изтриването на auth.users каскадно маха coop двойката/снимката; онлайн фирмите остават в света без собственик.
create or replace function public.delete_my_data(p_account boolean default false) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare u uuid := auth.uid(); n int := 0;
begin
  if u is null then return jsonb_build_object('ok', false, 'err', 'not_authenticated'); end if;
  if to_regclass('public.saves') is not null then
    execute 'delete from public.saves where user_id = $1' using u;
    get diagnostics n = row_count;
  end if;
  if p_account then delete from auth.users where id = u; end if;
  return jsonb_build_object('ok', true, 'saves', n, 'account', p_account);
end $$;
revoke all on function public.delete_my_data(boolean) from public, anon;
grant execute on function public.delete_my_data(boolean) to authenticated;
