-- ============================================================
-- Миграция 2: формат турнира «6 команд × 5 игроков»
-- (групповая стадия A/B, Bo3, сетка полуфиналы+финал)
-- Выполнить в Supabase SQL Editor после schema.sql.
-- ============================================================

-- Формат турнира
do $$ begin
  create type public.tournament_format as enum ('teams_6x5');
exception when duplicate_object then null; end $$;

alter table public.tournaments
  add column if not exists format public.tournament_format;

-- Команды в турнире
create table if not exists public.teams (
  id bigint generated always as identity primary key,
  tournament_id bigint not null references public.tournaments on delete cascade,
  name text not null,
  group_name char(1),                         -- 'A' | 'B', null до жеребьёвки
  created_at timestamptz not null default now(),
  unique (tournament_id, name)
);

-- Составы команд (капитан один)
create table if not exists public.team_players (
  team_id bigint not null references public.teams on delete cascade,
  player_id bigint not null references public.players on delete cascade,
  is_captain boolean not null default false,
  primary key (team_id, player_id)
);

-- Стадия серии
do $$ begin
  create type public.match_stage as enum ('group', 'semifinal', 'final');
exception when duplicate_object then null; end $$;

-- Серия (Bo3): групповая встреча, полуфинал или финал
create table if not exists public.series (
  id bigint generated always as identity primary key,
  tournament_id bigint not null references public.tournaments on delete cascade,
  stage public.match_stage not null,
  round smallint not null default 1,
  group_name char(1),
  team1_id bigint references public.teams on delete cascade,
  team2_id bigint references public.teams on delete cascade,
  team1_wins int not null default 0,          -- выигранных карт в серии
  team2_wins int not null default 0,
  status text not null default 'upcoming',    -- upcoming | live | finished
  created_at timestamptz not null default now()
);

-- Матч (карта) привязывается к серии; храним, кто из команд серии
-- был в демке командой 1 (та, что стартовала за T-сторону)
alter table public.matches
  add column if not exists series_id bigint references public.series on delete cascade,
  add column if not exists match_team1_id bigint references public.teams on delete set null,
  add column if not exists match_team2_id bigint references public.teams on delete set null;

-- В статистике запоминаем команду игрока в этом матче
alter table public.player_match_stats
  add column if not exists team_id bigint references public.teams on delete set null;

-- Индексы
create index if not exists idx_teams_tournament on public.teams (tournament_id);
create index if not exists idx_team_players_team on public.team_players (team_id);
create index if not exists idx_series_tournament on public.series (tournament_id);
create index if not exists idx_matches_series on public.matches (series_id);

-- RLS: публичное чтение
alter table public.teams enable row level security;
alter table public.team_players enable row level security;
alter table public.series enable row level security;

create policy "teams_public_read" on public.teams for select using (true);
create policy "team_players_public_read" on public.team_players for select using (true);
create policy "series_public_read" on public.series for select using (true);
