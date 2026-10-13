-- Администраторите може да се зададат и по имейл, преди акаунтът да е влязъл за първи път.
-- (Самите имейли НЕ са в миграцията — добавят се ръчно в online.admin_emails.)
create table if not exists online.admin_emails (email text primary key check (email = lower(email)), at timestamptz not null default now());
revoke all on online.admin_emails from public, anon, authenticated;
create or replace function online.is_admin(u uuid) returns boolean language sql stable security definer set search_path = online, public as $$
  select exists (select 1 from online.admins where user_id = u)
      or exists (select 1 from online.admin_emails e join auth.users au on lower(au.email) = e.email where au.id = u)
$$;
revoke all on function online.is_admin(uuid) from public, anon, authenticated;
