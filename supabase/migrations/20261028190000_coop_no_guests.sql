-- guest-cloud (28.10.2026): гостите (анонимен вход в Supabase) пазят играта си в облака, но партньорството иска истински акаунт.
-- Всички coop_* функции започват с coop.me() → проверката е на едно място.
create or replace function coop.me() returns uuid language plpgsql stable as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'not_authenticated'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'coop_limit: За партньорство е нужен акаунт.';
  end if;
  return u;
end $$;
