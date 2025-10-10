create or replace function public.is_admin(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_user_id
      and ur.role = 'Admin'
  );
end;
$$;

grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to anon;

drop policy if exists "user_roles_admin" on public.user_roles;
create policy "user_roles_admin" on public.user_roles
  for all using (
    auth.role() = 'service_role'
    or (auth.role() = 'authenticated' and public.is_admin(auth.uid()))
  );

drop policy if exists "role_modules_admin" on public.role_modules;
create policy "role_modules_admin" on public.role_modules
  for all using (
    auth.role() = 'service_role'
    or (auth.role() = 'authenticated' and public.is_admin(auth.uid()))
  );
