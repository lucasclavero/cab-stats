import type {
  GameSummary,
  ParsedGame,
  PlayerBox,
  PlayerGameLog,
  PlayerSeason,
  RankDef,
  SeasonReport,
  TeamBox,
  TeamSeason,
} from "../types";
import { fmtMin, normName, pct, prettyTeam, teamMatch } from "./format";

function emptyTeam(name: string): TeamSeason {
  return {
    name,
    gp: 0,
    w: 0,
    l: 0,
    pf: 0,
    pa: 0,
    f2m: 0,
    f2a: 0,
    f3m: 0,
    f3a: 0,
    ftm: 0,
    fta: 0,
    defr: 0,
    offr: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    to: 0,
    blk: 0,
    fc: 0,
    fr: 0,
    val: 0,
  };
}

function addPlayer(t: TeamSeason, p: PlayerBox) {
  t.f2m += p.f2m;
  t.f2a += p.f2a;
  t.f3m += p.f3m;
  t.f3a += p.f3a;
  t.ftm += p.ftm;
  t.fta += p.fta;
  t.defr += p.defr;
  t.offr += p.offr;
  t.reb += p.reb;
  t.ast += p.ast;
  t.stl += p.stl;
  t.to += p.to;
  t.blk += p.blk;
  t.fc += p.fc;
  t.fr += p.fr;
  t.val += p.val;
}

function teamPts(players: PlayerBox[]): number {
  return players.reduce((s, p) => s + p.pts, 0);
}

function sameTeam(a: string, b: string): boolean {
  return teamMatch(a, b);
}

export function listTeams(games: ParsedGame[]): string[] {
  const names = new Map<string, string>();
  for (const g of games) {
    for (const t of g.teams) {
      const key = t.name.toUpperCase().replace(/\s+/g, " ").trim();
      if (!names.has(key)) names.set(key, t.displayName);
    }
  }
  return [...names.values()];
}

export function inferFocusTeam(games: ParsedGame[]): string {
  const counts = new Map<string, { n: number; display: string }>();
  for (const g of games) {
    for (const t of g.teams) {
      const key = t.name.toUpperCase().replace(/\s+/g, " ").trim();
      const cur = counts.get(key) ?? { n: 0, display: t.displayName };
      cur.n += 1;
      counts.set(key, cur);
    }
  }
  const all = [...counts.values()].sort((a, b) => b.n - a.n);
  return all[0]?.display ?? "";
}

function pickSide(game: ParsedGame, focus: string): { us: TeamBox; them: TeamBox; loc: "L" | "V" } {
  const us =
    game.teams.find((t) => sameTeam(t.displayName, focus) || sameTeam(t.name, focus)) ??
    game.teams[0];
  const them = game.teams.find((t) => t !== us) ?? game.teams[1];
  const loc: "L" | "V" = sameTeam(game.home, us.name) || sameTeam(game.homeDisplay, us.displayName) ? "L" : "V";
  return { us, them, loc };
}

export function rankDefs(games: number): RankDef[] {
  const f2 = Math.max(8, Math.round((20 * games) / 15));
  const f3 = Math.max(6, Math.round((15 * games) / 15));
  const ft = Math.max(6, Math.round((15 * games) / 15));
  const fg = Math.max(10, Math.round((25 * games) / 15));
  const ppgGp = Math.max(2, Math.ceil(games * 0.3));
  return [
    { id: "pts", label: "Puntos", note: `Totales en ${games} partido${games === 1 ? "" : "s"}`, key: "pts" },
    { id: "ppg", label: "PPG", note: `Mínimo ${ppgGp} partidos`, key: "ppg", minGp: ppgGp },
    { id: "f2m", label: "Tiros de 2", note: "Convertidos / intentos", key: "f2m", shots: { m: "f2m", a: "f2a", p: "f2p" } },
    { id: "f2p", label: "% dobles", note: `Mínimo ${f2} intentos de 2`, key: "f2p", minAtt: f2, attKey: "f2a", shots: { m: "f2m", a: "f2a", p: "f2p" }, suffix: "%" },
    { id: "f3m", label: "Tiros de 3", note: "Convertidos / intentos", key: "f3m", shots: { m: "f3m", a: "f3a", p: "f3p" } },
    { id: "f3p", label: "% triples", note: `Mínimo ${f3} intentos de 3`, key: "f3p", minAtt: f3, attKey: "f3a", shots: { m: "f3m", a: "f3a", p: "f3p" }, suffix: "%" },
    { id: "ftm", label: "Libres", note: "Convertidos / intentos", key: "ftm", shots: { m: "ftm", a: "fta", p: "ftp" } },
    { id: "ftp", label: "% libres", note: `Mínimo ${ft} intentos de TL`, key: "ftp", minAtt: ft, attKey: "fta", shots: { m: "ftm", a: "fta", p: "ftp" }, suffix: "%" },
    { id: "fgp", label: "% TC", note: `Mínimo ${fg} intentos de campo`, key: "fgp", minAtt: fg, attKey: "fga", shots: { m: "fgm", a: "fga", p: "fgp" }, suffix: "%" },
    { id: "efg", label: "eFG%", note: `Mínimo ${fg} intentos · (2P + 1.5×3P) / intentos`, key: "efg", minAtt: fg, attKey: "fga", suffix: "%" },
    { id: "ts", label: "TS%", note: `Mínimo ${fg} intentos`, key: "ts", minAtt: fg, attKey: "fga", suffix: "%" },
    { id: "reb", label: "Rebotes", note: "Totales (defensivos + ofensivos)", key: "reb" },
    { id: "defr", label: "Reb. def.", note: "Rebotes defensivos", key: "defr" },
    { id: "offr", label: "Reb. of.", note: "Rebotes ofensivos", key: "offr" },
    { id: "ast", label: "Asistencias", note: "Totales", key: "ast" },
    { id: "stl", label: "Robos", note: "Totales", key: "stl" },
    { id: "to", label: "Pérdidas", note: "Más pérdidas (no es un ranking positivo)", key: "to" },
    { id: "blk", label: "Tapas", note: "Tapones a favor", key: "blk" },
    { id: "val", label: "Valoración", note: "Índice de valoración CABB", key: "val" },
    { id: "min", label: "Minutos", note: "Minutos jugados", key: "min", isMin: true },
    { id: "pm", label: "+/−", note: "Diferencial de puntos en cancha", key: "pm" },
  ];
}

export function buildReport(parsed: ParsedGame[], focusDisplay: string): SeasonReport {
  const focus = focusDisplay || inferFocusTeam(parsed);
  const team = emptyTeam(focus);
  const games: GameSummary[] = [];
  const agg = new Map<string, PlayerSeason>();

  for (const g of parsed) {
    const { us, them, loc } = pickSide(g, focus);
    const pf = teamPts(us.players);
    const pa = teamPts(them.players);
    team.gp += 1;
    team.pf += pf;
    team.pa += pa;
    if (pf > pa) team.w += 1;
    else team.l += 1;
    for (const p of us.players) addPlayer(team, p);

    const summary: GameSummary = {
      fileName: g.fileName,
      opp: them.displayName || prettyTeam(them.name),
      loc,
      us: pf,
      them: pa,
      players: us.players.filter((p) => p.sec > 0),
    };
    games.push(summary);

    for (const p of summary.players) {
      const key = normName(p.rawName || p.name);
      const cur =
        agg.get(key) ??
        ({
          key,
          name: p.name,
          gp: 0,
          min: "0:00",
          sec: 0,
          pts: 0,
          ppg: 0,
          rpg: 0,
          apg: 0,
          mpg: 0,
          f2m: 0,
          f2a: 0,
          f2p: null,
          f3m: 0,
          f3a: 0,
          f3p: null,
          ftm: 0,
          fta: 0,
          ftp: null,
          fgm: 0,
          fga: 0,
          fgp: null,
          efg: null,
          ts: null,
          defr: 0,
          offr: 0,
          reb: 0,
          ast: 0,
          stl: 0,
          to: 0,
          blk: 0,
          val: 0,
          vpg: 0,
          pm: 0,
          log: [] as PlayerGameLog[],
        } satisfies PlayerSeason);
      cur.gp += 1;
      cur.sec += p.sec;
      cur.pts += p.pts;
      cur.f2m += p.f2m;
      cur.f2a += p.f2a;
      cur.f3m += p.f3m;
      cur.f3a += p.f3a;
      cur.ftm += p.ftm;
      cur.fta += p.fta;
      cur.defr += p.defr;
      cur.offr += p.offr;
      cur.reb += p.reb;
      cur.ast += p.ast;
      cur.stl += p.stl;
      cur.to += p.to;
      cur.blk += p.blk;
      cur.val += p.val;
      cur.pm += p.pm;
      cur.log.push({
        opp: summary.opp,
        loc,
        us: pf,
        them: pa,
        min: p.min,
        pts: p.pts,
        f2: `${p.f2m}/${p.f2a}`,
        f3: `${p.f3m}/${p.f3a}`,
        ft: `${p.ftm}/${p.fta}`,
        reb: p.reb,
        ast: p.ast,
        stl: p.stl,
        to: p.to,
        blk: p.blk,
        val: p.val,
        pm: p.pm,
      });
      agg.set(key, cur);
    }
  }

  const players = [...agg.values()].map((p) => {
    const fgm = p.f2m + p.f3m;
    const fga = p.f2a + p.f3a;
    const tsDen = 2 * (fga + 0.44 * p.fta);
    return {
      ...p,
      min: fmtMin(p.sec),
      ppg: Math.round((10 * p.pts) / p.gp) / 10,
      rpg: Math.round((10 * p.reb) / p.gp) / 10,
      apg: Math.round((10 * p.ast) / p.gp) / 10,
      mpg: Math.round((10 * p.sec) / p.gp / 60) / 10,
      f2p: pct(p.f2m, p.f2a),
      f3p: pct(p.f3m, p.f3a),
      ftp: pct(p.ftm, p.fta),
      fgm,
      fga,
      fgp: pct(fgm, fga),
      efg: pct(p.f2m + 1.5 * p.f3m, fga),
      ts: tsDen > 0 ? Math.round((1000 * p.pts) / tsDen) / 10 : null,
      vpg: Math.round((10 * p.val) / p.gp) / 10,
    };
  });
  players.sort((a, b) => b.sec - a.sec);

  return {
    team,
    games,
    players,
    teamsInFiles: listTeams(parsed),
    ranks: rankDefs(games.length),
  };
}

export function topPlayers(players: PlayerSeason[], def: RankDef, n = 5): PlayerSeason[] {
  let pool = players.filter((p) => p.gp >= (def.minGp ?? 1));
  if (def.minAtt && def.attKey) {
    pool = pool.filter((p) => Number(p[def.attKey!]) >= def.minAtt!);
  }
  pool = pool.filter((p) => p[def.key] != null);
  if (def.isMin) {
    return [...pool].sort((a, b) => b.sec - a.sec).slice(0, n);
  }
  return [...pool].sort((a, b) => Number(b[def.key]) - Number(a[def.key])).slice(0, n);
}
