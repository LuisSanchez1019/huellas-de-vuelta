-- Huellas de Vuelta: perfiles y mascotas iniciales.
-- Ejecutar en un proyecto nuevo de Supabase desde SQL Editor o la CLI.

create type public.pet_status as enum ('at_home', 'lost', 'found', 'for_adoption');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  species text not null check (species in ('dog', 'cat', 'other')),
  breed text check (char_length(breed) <= 100),
  color text check (char_length(color) <= 100),
  description text check (char_length(description) <= 2000),
  status public.pet_status not null default 'at_home',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pets_owner_id_idx on public.pets(owner_id);
create index pets_status_idx on public.pets(status) where is_archived = false;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create trigger pets_set_updated_at
before update on public.pets
for each row execute procedure public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.pets enable row level security;

create policy "Users can read their own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Users can read their own pets"
on public.pets for select to authenticated
using ((select auth.uid()) = owner_id);

create policy "Users can create their own pets"
on public.pets for insert to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Users can update their own pets"
on public.pets for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Users can delete their own pets"
on public.pets for delete to authenticated
using ((select auth.uid()) = owner_id);
