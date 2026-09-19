export type ShotLine = {
  m: number;
  a: number;
};

export type PlayerBox = {
  jersey: string;
  rawName: string;
  name: string;
  min: string;
  sec: number;
  pts: number;
  f2m: number;
  f2a: number;
  f3m: number;
  f3a: number;
  ftm: number;
  fta: number;
  defr: number;
  offr: number;
  reb: number;
  ast: number;
  stl: number;
  to: number;
  blk: number;
  tr: number;
  fc: number;
  fr: number;
  val: number;
  pm: number;
};

export type TeamBox = {
  name: string;
  displayName: string;
  players: PlayerBox[];
};

export type ParsedGame = {
  fileName: string;
  title: string;
  home: string;
  away: string;
  homeDisplay: string;
  awayDisplay: string;
  teams: TeamBox[];
};

export type GameSummary = {
  fileName: string;
  opp: string;
  loc: "L" | "V";
  us: number;
  them: number;
  players: PlayerBox[];
};

export type PlayerSeason = {
  key: string;
  name: string;
  gp: number;
  min: string;
  sec: number;
  pts: number;
  ppg: number;
  rpg: number;
  apg: number;
  mpg: number;
  f2m: number;
  f2a: number;
  f2p: number | null;
  f3m: number;
  f3a: number;
  f3p: number | null;
  ftm: number;
  fta: number;
  ftp: number | null;
  fgm: number;
  fga: number;
  fgp: number | null;
  efg: number | null;
  ts: number | null;
  defr: number;
  offr: number;
  reb: number;
  ast: number;
  stl: number;
  to: number;
  blk: number;
  val: number;
  vpg: number;
  pm: number;
  log: PlayerGameLog[];
};

export type PlayerGameLog = {
  opp: string;
  loc: "L" | "V";
  us: number;
  them: number;
  min: string;
  pts: number;
  f2: string;
  f3: string;
  ft: string;
  reb: number;
  ast: number;
  stl: number;
  to: number;
  blk: number;
  val: number;
  pm: number;
};

export type TeamSeason = {
  name: string;
  gp: number;
  w: number;
  l: number;
  pf: number;
  pa: number;
  f2m: number;
  f2a: number;
  f3m: number;
  f3a: number;
  ftm: number;
  fta: number;
  defr: number;
  offr: number;
  reb: number;
  ast: number;
  stl: number;
  to: number;
  blk: number;
  fc: number;
  fr: number;
  val: number;
};

export type RankId =
  | "pts"
  | "ppg"
  | "f2m"
  | "f2p"
  | "f3m"
  | "f3p"
  | "ftm"
  | "ftp"
  | "fgp"
  | "efg"
  | "ts"
  | "reb"
  | "defr"
  | "offr"
  | "ast"
  | "stl"
  | "to"
  | "blk"
  | "val"
  | "min"
  | "pm";

export type RankDef = {
  id: RankId;
  label: string;
  note: string;
  key: keyof PlayerSeason;
  minGp?: number;
  minAtt?: number;
  attKey?: keyof PlayerSeason;
  shots?: { m: keyof PlayerSeason; a: keyof PlayerSeason; p: keyof PlayerSeason };
  suffix?: string;
  isMin?: boolean;
};

export type SeasonReport = {
  team: TeamSeason;
  games: GameSummary[];
  players: PlayerSeason[];
  teamsInFiles: string[];
  ranks: RankDef[];
};
