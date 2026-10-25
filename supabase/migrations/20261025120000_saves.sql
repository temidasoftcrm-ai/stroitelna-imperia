-- ПРИЛОЖЕНА в Supabase 25.10.2026 (supabase db query --linked -f, без db push).
-- saves — облачните записи на самостоятелната игра (public.saves, cloud.js). Таблицата е създадена ръчно в таблото и я нямаше в миграциите.
-- Тази миграция я ОПИСВА и затяга, без да чупи живата: create … if not exists, ограниченията са NOT VALID (старите редове не се проверяват),
-- политиките се пресъздават по име. Може да се пуска повече от веднъж. Прилага се през SQL Editor (f1), НЕ с supabase db push.
--
-- Клиентът (cloud.js): upsert { user_id, slot: 's1'…'s3', data (jsonb: целият запис или { $z: 'gzip64', d, n }), meta (jsonb), updated_at }
-- без onConflict → конфликтът е по първичния ключ (user_id, slot); select 'slot,data,meta,updated_at' / 'slot,updated_at' — само своите.
-- delete_my_data (account_all) трие своите редове.
--
-- Преди прилагане — ако живата схема е различна (друг PK, други колони), миграцията НЕ я променя; провери с (само четене):
--   select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name = 'saves' order by ordinal_position;
--   select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.saves'::regclass;
--   select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public' and tablename = 'saves';
--   select relrowsecurity, relforcerowsecurity from pg_class where oid = 'public.saves'::regclass;
--   select grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name = 'saves';

create table if not exists public.saves (
  user_id uuid not null references auth.users on delete cascade,
  slot text not null,
  data jsonb not null,
  meta jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);

-- ограниченията: слотът е s1…s9 (сега 3); записът до 8 MB (несгъстеният е ~2,3 MB); meta — малка. NOT VALID — само за новите записи.
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.saves'::regclass and conname = 'saves_slot_ok') then
    alter table public.saves add constraint saves_slot_ok check (slot ~ '^s[1-9]$') not valid; end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.saves'::regclass and conname = 'saves_data_size') then
    alter table public.saves add constraint saves_data_size check (pg_column_size(data) <= 8 * 1024 * 1024) not valid; end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.saves'::regclass and conname = 'saves_meta_size') then
    alter table public.saves add constraint saves_meta_size check (meta is null or pg_column_size(meta) <= 4096) not valid; end if;
end $$;

-- RLS: всеки вижда и пише само своите записи
alter table public.saves enable row level security;
drop policy if exists saves_select_own on public.saves;
drop policy if exists saves_insert_own on public.saves;
drop policy if exists saves_update_own on public.saves;
drop policy if exists saves_delete_own on public.saves;
create policy saves_select_own on public.saves for select to authenticated using ((select auth.uid()) = user_id);
create policy saves_insert_own on public.saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy saves_update_own on public.saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy saves_delete_own on public.saves for delete to authenticated using ((select auth.uid()) = user_id);
-- ВНИМАНИЕ: политиките са „permissive“ — ако в таблото има стари политики с други имена (напр. „Enable read access for all users“),
-- те се събират с ИЛИ и могат да отварят повече. Провери pg_policies (горе) и махни излишните ръчно.

revoke all on public.saves from anon;
grant select, insert, update, delete on public.saves to authenticated;

-- updated_at идва от клиента (часовникът му може да е грешен — сравнява се с локалния запис); сървърът не го пипа.
-- Индекс: първичният ключ (user_id, slot) покрива всички заявки на клиента — друг не трябва.
