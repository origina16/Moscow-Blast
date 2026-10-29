-- ============================================================
-- Moscow Blast — схема БД (Supabase, PostgreSQL)
-- Выполнить в Supabase SQL Editor целиком.
-- ============================================================

-- Роли пользователей
create type public.user_role as enum ('player', 'organizer');

-- Профили: 1:1 с auth.users
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role public.user_role not null default 'player',
  created_at timestamptz not null default now()
);

-- При регистрации создаём профиль автоматически
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Игроки (участники турниров; могут не иметь аккаунта на сайте)
create table public.players (
  id bigint generated always as identity primary key,
  nickname text not null unique,
  user_id uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

create table public.maps (
  id bigint generated always as identity primary key,
  name text not null unique  -- 'de_mirage', 'de_inferno', ...
);

-- Турниры
create table public.tournaments (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  created_by uuid not null references public.profiles on delete cascade,
  starts_at timestamptz,
  status text not null default 'upcoming',   -- upcoming | live | finished
  created_at timestamptz not null default now()
);

-- Состав участников турнира
create table public.tournament_players (
  tournament_id bigint not null references public.tournaments on delete cascade,
  player_id bigint not null references public.players on delete cascade,
  added_at timestamptz not null default now(),
  primary key (tournament_id, player_id)
);

-- Матчи (одна карта = один матч). Демка привязана к матчу.
create table public.matches (
  id bigint generated always as identity primary key,
  tournament_id bigint not null references public.tournaments on delete cascade,
  map_id bigint references public.maps on delete set null,
  played_at timestamptz not null default now(),
  team1_name text not null default 'Team 1',
  team2_name text not null default 'Team 2',
  team1_score int not null default 0,
  team2_score int not null default 0,
  demo_path text,                 -- путь файла в Supabase Storage (bucket 'demos')
  parsed boolean not null default false,
  parse_error text,
  created_at timestamptz not null default now()
);

-- Статистика игрока в конкретном матче
create table public.player_match_stats (
  match_id bigint not null references public.matches on delete cascade,
  player_id bigint not null references public.players on delete cascade,
  team smallint not null default 1,          -- 1 = team1, 2 = team2
  kills int not null default 0,
  deaths int not null default 0,
  assists int not null default 0,
  hs_kills int not null default 0,
  damage int not null default 0,
  rounds_played int not null default 0,
  mvps int not null default 0,
  primary key (match_id, player_id)
);

-- ============================================================
-- Индексы
-- ============================================================
create index idx_tournament_players_player on public.tournament_players (player_id);
create index idx_matches_tournament on public.matches (tournament_id);
create index idx_pms_player on public.player_match_stats (player_id);

-- ============================================================
-- RLS: публичное чтение, запись — только через сервер (service role)
-- ============================================================
alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_players enable row level security;
alter table public.matches enable row level security;
alter table public.player_match_stats enable row level security;
alter table public.maps enable row level security;

create policy "profiles_select_self" on public.profiles
  for select using (auth.uid() = id);

create policy "players_public_read" on public.players for select using (true);
create policy "tournaments_public_read" on public.tournaments for select using (true);
create policy "tournament_players_public_read" on public.tournament_players for select using (true);
create policy "matches_public_read" on public.matches for select using (true);
create policy "pms_public_read" on public.player_match_stats for select using (true);
create policy "maps_public_read" on public.maps for select using (true);

-- ============================================================
-- Storage: бакет для демок
-- ============================================================
insert into storage.buckets (id, name, public) values ('demos', 'demos', true)
  on conflict (id) do nothing;

-- ============================================================
-- Стартовый набор карт
-- ============================================================
insert into public.maps (name) values
  ('de_mirage'), ('de_inferno'), ('de_dust2'), ('de_nuke'),
  ('de_ancient'), ('de_anubis'), ('de_vertigo'), ('de_train'),
  ('de_overpass'), ('de_cache'), ('de_mills'), ('de_office')
on conflict (name) do nothing;
