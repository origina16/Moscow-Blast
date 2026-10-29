export type Role = "player" | "organizer";

export interface Profile {
  id: string;
  role: Role;
  created_at?: string;
}

export interface Player {
  id: number;
  nickname: string;
  user_id: string | null;
  created_at?: string;
}

export interface Tournament {
  id: number;
  name: string;
  description: string | null;
  created_by: string;
  starts_at: string | null;
  status: "upcoming" | "live" | "finished";
  format: "teams_6x5" | null;   // null = классический режим без команд
  created_at?: string;
}

export interface Team {
  id: number;
  tournament_id: number;
  name: string;
  group_name: "A" | "B" | null;
  created_at?: string;
}

export interface TeamPlayerRow {
  team_id: number;
  player_id: number;
  is_captain: boolean;
}

export type Stage = "group" | "semifinal" | "final";

export interface Series {
  id: number;
  tournament_id: number;
  stage: Stage;
  round: number;
  group_name: "A" | "B" | null;
  team1_id: number | null;
  team2_id: number | null;
  team1_wins: number;
  team2_wins: number;
  status: "upcoming" | "live" | "finished";
  created_at?: string;
}

export interface MatchRow {
  id: number;
  tournament_id: number;
  map_id: number | null;
  series_id: number | null;
  match_team1_id: number | null;  // команда — «team 1» демки (стартовала за T)
  match_team2_id: number | null;
  played_at: string;
  team1_name: string;
  team2_name: string;
  team1_score: number;
  team2_score: number;
  demo_path: string | null;
  parsed: boolean;
  parse_error: string | null;
}

export interface PlayerMatchStatsRow {
  match_id: number;
  player_id: number;
  team: number;
  kills: number;
  deaths: number;
  assists: number;
  hs_kills: number;
  damage: number;
  rounds_played: number;
  mvps: number;
}

/** Средняя статистика игрока по всем его матчам. */
export interface PlayerAverages {
  games: number;
  kills: number;      // в среднем за игру
  deaths: number;
  assists: number;
  adr: number;        // average damage per round
  hsPercent: number;  // % хедшотов
  kd: number;
  totalDamage: number;
}
