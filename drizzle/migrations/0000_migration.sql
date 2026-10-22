create type public.app_role as enum ('admin','owner','viewer');
create type public.doc_permission as enum ('read','edit');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- email column must not be changed by users
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null check (char_length(name) between 1 and 200),
  category text not null default 'General' check (char_length(category) between 1 and 60),
  description text check (description is null or char_length(description) <= 1000),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.documents(owner_id);

create table public.document_permissions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null,
  permission public.doc_permission not null,
  granted_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, user_id)
);
create index on public.document_permissions(user_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  document_id uuid,
  action text not null,
  outcome text not null check (outcome in ('success','denied','failure')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_logs(created_at desc);

-- Access helpers (security definer avoids recursive RLS)
create or replace function public.can_read_document(_doc uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.documents d where d.id = _doc and d.owner_id = _user)
      or exists (select 1 from public.document_permissions p where p.document_id = _doc and p.user_id = _user and p.permission in ('read','edit'))
      or public.has_role(_user, 'admin')
$$;
create or replace function public.can_edit_document(_doc uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.documents d where d.id = _doc and d.owner_id = _user)
      or exists (select 1 from public.document_permissions p where p.document_id = _doc and p.user_id = _user and p.permission = 'edit')
$$;
create or replace function public.is_document_owner(_doc uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.documents d where d.id = _doc and d.owner_id = _user)
$$;
revoke execute on function public.can_read_document, public.can_edit_document, public.is_document_owner, public.has_role from anon, public;
grant execute on function public.can_read_document, public.can_edit_document, public.is_document_owner, public.has_role to authenticated, service_role;

grant select, update on public.documents to authenticated;
grant all on public.documents to service_role;
alter table public.documents enable row level security;
create policy "read authorized docs" on public.documents for select to authenticated using (public.can_read_document(id, auth.uid()));
create policy "edit authorized docs" on public.documents for update to authenticated using (public.can_edit_document(id, auth.uid())) with check (public.can_edit_document(id, auth.uid()));
-- only metadata columns are user-updatable; owner_id/storage_path/size are locked
revoke update on public.documents from authenticated;
grant update (name, category, description) on public.documents to authenticated;

grant select on public.document_permissions to authenticated;
grant all on public.document_permissions to service_role;
alter table public.document_permissions enable row level security;
create policy "owner or grantee reads perms" on public.document_permissions for select to authenticated
  using (user_id = auth.uid() or public.is_document_owner(document_id, auth.uid()) or public.has_role(auth.uid(),'admin'));

grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "admins read audit" on public.audit_logs for select to authenticated using (public.has_role(auth.uid(),'admin'));
-- no insert/update/delete policies: only the trusted server writes; logs are append-only
create or replace function public.audit_immutable() returns trigger language plpgsql set search_path = public as $$
begin raise exception 'audit_logs are append-only'; end $$;
create trigger audit_no_update before update or delete on public.audit_logs for each row execute function public.audit_immutable();

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger documents_touch before update on public.documents for each row execute function public.touch_updated_at();
create trigger perms_touch before update on public.document_permissions for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email,''), coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email,''),'@',1)));
  insert into public.user_roles (user_id, role) values (new.id, 'owner');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();