import { useMemo, useRef, useState } from "react";
import { Donut, HBar, LineChart } from "./charts";
import { buildReport, inferFocusTeam, topPlayers } from "./lib/aggregate";
import { fmtPct, locLabel, shot, signed } from "./lib/format";
import { parseFile } from "./lib/parse";
import type { ParsedGame, PlayerSeason, RankDef, SeasonReport } from "./types";

const INFO = "#6cb6ff";
const WARN = "#d6a354";
const MUTED = "#8b8b8b";

type Section = "equipo" | "rankings" | "jugador";

function rankValue(p: PlayerSeason, def: RankDef): string {
  if (def.shots) {
    return shot(Number(p[def.shots.m]), Number(p[def.shots.a]), p[def.shots.p] as number | null);
  }
  if (def.isMin) return p.min;
  const v = p[def.key];
  if (typeof v === "number" && def.suffix === "%") return `${v.toFixed(1)}%`;
  if (def.id === "pm" && typeof v === "number") return signed(v);
  if (def.id === "ppg" && typeof v === "number") return v.toFixed(1);
  return String(v);
}

function chartValue(p: PlayerSeason, def: RankDef): number {
  if (def.isMin) return Math.round(p.sec / 60);
  return Number(p[def.key]);
}

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [parsed, setParsed] = useState<ParsedGame[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState("");
  const [section, setSection] = useState<Section>("equipo");
  const [rankId, setRankId] = useState<string>("pts");
  const [playerKey, setPlayerKey] = useState("");
  const [drag, setDrag] = useState(false);

  async function ingest(list: File[]) {
    if (!list.length) return;
    setBusy(true);
    const nextFiles = [...files];
    const nextParsed = [...parsed];
    const nextErrors = [...errors];
    for (const file of list) {
      if (nextFiles.some((f) => f.name === file.name && f.size === file.size)) continue;
      try {
        const game = await parseFile(file);
        nextFiles.push(file);
        nextParsed.push(game);
      } catch (err) {
        nextErrors.push(err instanceof Error ? err.message : String(err));
      }
    }
    setFiles(nextFiles);
    setParsed(nextParsed);
    setErrors(nextErrors);
    if (!focus && nextParsed.length) setFocus(inferFocusTeam(nextParsed));
    setBusy(false);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    void ingest(Array.from(e.target.files ?? []));
    e.target.value = "";
  }

  async function loadSamples() {
    const names = [
      "estadisticaPartido_202619929.xlsx",
      "estadisticaPartido_202619103.xlsx",
      "estadisticaPartido_2026191031.xlsx",
      "estadisticaPartido_202623832.xlsx",
    ];
    const loaded: File[] = [];
    for (const name of names) {
      const res = await fetch(`/samples/${name}`);
      if (!res.ok) continue;
      const blob = await res.blob();
      loaded.push(new File([blob], name, { type: blob.type }));
    }
    await ingest(loaded);
  }

  function clearAll() {
    setFiles([]);
    setParsed([]);
    setErrors([]);
    setFocus("");
    setPlayerKey("");
    setSection("equipo");
  }

  const report: SeasonReport | null = useMemo(() => {
    if (!parsed.length) return null;
    return buildReport(parsed, focus);
  }, [parsed, focus]);

  const rank = report?.ranks.find((r) => r.id === rankId) ?? report?.ranks[0];
  const leaders = report && rank ? topPlayers(report.players, rank) : [];
  const selectedPlayer =
    report?.players.find((p) => p.key === playerKey) ?? report?.players[0] ?? null;

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Planillas CABB · XLS / PDF</p>
          <h1>{report?.team.name || "Estadísticas de equipo"}</h1>
          {report ? (
            <p className="sub">
              {report.team.gp} {report.team.gp === 1 ? "partido" : "partidos"} · {report.team.w}{" "}
              {report.team.w === 1 ? "ganado" : "ganados"}, {report.team.l}{" "}
              {report.team.l === 1 ? "perdido" : "perdidos"}
            </p>
          ) : (
            <p className="sub">Subí una o más planillas oficiales para armar el recorte.</p>
          )}
        </div>
        {report && report.teamsInFiles.length > 1 ? (
          <label className="team-select">
            Equipo
            <select value={focus} onChange={(e) => setFocus(e.target.value)}>
              {report.teamsInFiles.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>

      <section
        className={`drop ${drag ? "drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void ingest(Array.from(e.dataTransfer.files));
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.pdf,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          multiple
          onChange={onPick}
        />
        <p>
          Arrastrá planillas o{" "}
          <button type="button" className="link" onClick={() => inputRef.current?.click()}>
            elegí archivos
          </button>
        </p>
        <p className="hint">.xlsx, .xls o .pdf de estadística de partido CABB. Podés cargar varios.</p>
        {busy ? <p className="hint">Leyendo archivos…</p> : null}
        {files.length ? (
          <ul className="file-list">
            {files.map((f) => (
              <li key={f.name}>{f.name}</li>
            ))}
          </ul>
        ) : null}
        <div className="drop-actions">
          {!files.length ? (
            <button type="button" className="ghost" onClick={() => void loadSamples()}>
              Probar con 4 partidos de Arenal
            </button>
          ) : (
            <button type="button" className="ghost" onClick={clearAll}>
              Quitar todo
            </button>
          )}
        </div>
      </section>

      {errors.length ? (
        <div className="callout danger">
          <strong>No se pudieron leer algunos archivos</strong>
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      ) : null}

      {report ? (
        <>
          <div className="pills">
            {(
              [
                ["equipo", "Equipo"],
                ["rankings", "Top 5"],
                ["jugador", "Jugador"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`pill ${section === id ? "active" : ""}`}
                onClick={() => setSection(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {section === "equipo" ? <TeamSection report={report} /> : null}
          {section === "rankings" && rank ? (
            <RankingsSection
              report={report}
              rank={rank}
              rankId={rank.id}
              setRankId={setRankId}
              leaders={leaders}
            />
          ) : null}
          {section === "jugador" && selectedPlayer ? (
            <PlayerSection
              report={report}
              player={selectedPlayer}
              playerKey={selectedPlayer.key}
              setPlayerKey={setPlayerKey}
            />
          ) : null}

          <p className="source">
            Fuente: planillas CABB cargadas localmente · {report.games.length}{" "}
            {report.games.length === 1 ? "partido" : "partidos"}
          </p>
        </>
      ) : null}
    </div>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: "warn" | "danger" | "ok";
}) {
  return (
    <div className="stat">
      <b className={tone}>{value}</b>
      <span>{label}</span>
    </div>
  );
}

function TeamSection({ report }: { report: SeasonReport }) {
  const t = report.team;
  const gp = Math.max(t.gp, 1);
  const fga = t.f2a + t.f3a;
  const fgm = t.f2m + t.f3m;
  const pts2 = t.f2m * 2;
  const pts3 = t.f3m * 3;
  const efg = fga ? ((100 * (t.f2m + 1.5 * t.f3m)) / fga).toFixed(1) : "—";
  const ts = ((100 * t.pf) / (2 * (fga + 0.44 * t.fta) || 1)).toFixed(1);
  const rosterCut = Math.max(1, Math.round(t.gp / 4));
  const roster = report.players.filter((p) => p.gp >= rosterCut);
  const gameCats = report.games.map(
    (g, i) => `${i + 1}. ${g.opp}${g.loc === "V" ? " V" : ""}`,
  );

  return (
    <div className="stack">
      <div className="stats">
        <Stat value={`${t.w}–${t.l}`} label="Récord" />
        <Stat value={(t.pf / gp).toFixed(1)} label="Puntos por partido" />
        <Stat value={(t.pa / gp).toFixed(1)} label="Puntos en contra" tone="warn" />
        <Stat
          value={signed(t.pf - t.pa)}
          label="Diferencia total"
          tone={t.pf >= t.pa ? "ok" : "danger"}
        />
      </div>

      <div className="callout">
        <strong>Perfil ofensivo</strong>
        <p>
          El equipo anota {(t.pf / gp).toFixed(1)} y recibe {(t.pa / gp).toFixed(1)}. Triple{" "}
          {fmtPct(t.f3m, t.f3a)}, libres {fmtPct(t.ftm, t.fta)}. Hay {(t.to / gp).toFixed(1)}{" "}
          pérdidas por partido frente a {(t.ast / gp).toFixed(1)} asistencias.
        </p>
      </div>

      <h2>Tiro del equipo</h2>
      <p className="hint">
        Distribución de {t.pf} puntos a favor · eFG {efg}% · TS {ts}%
      </p>
      <div className="split">
        <Donut
          data={[
            { label: `Dobles ${pts2} pts`, value: pts2, color: INFO },
            { label: `Triples ${pts3} pts`, value: pts3, color: WARN },
            { label: `Libres ${t.ftm} pts`, value: t.ftm, color: MUTED },
          ]}
        />
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Conv/Int</th>
              <th>%</th>
              <th>Puntos</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Dobles</td>
              <td>{`${t.f2m}/${t.f2a}`}</td>
              <td>{fmtPct(t.f2m, t.f2a)}</td>
              <td>{pts2}</td>
            </tr>
            <tr>
              <td>Triples</td>
              <td>{`${t.f3m}/${t.f3a}`}</td>
              <td>{fmtPct(t.f3m, t.f3a)}</td>
              <td>{pts3}</td>
            </tr>
            <tr>
              <td>Libres</td>
              <td>{`${t.ftm}/${t.fta}`}</td>
              <td>{fmtPct(t.ftm, t.fta)}</td>
              <td>{t.ftm}</td>
            </tr>
            <tr>
              <td>Campo</td>
              <td>{`${fgm}/${fga}`}</td>
              <td>{fmtPct(fgm, fga)}</td>
              <td>{pts2 + pts3}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Rebotes, pases y defensa</h2>
      <div className="stats">
        <Stat value={(t.reb / gp).toFixed(1)} label="Rebotes / partido" />
        <Stat value={`${t.defr} / ${t.offr}`} label="Def / Of" />
        <Stat value={(t.ast / gp).toFixed(1)} label="Asistencias / partido" />
        <Stat value={(t.stl / gp).toFixed(1)} label="Robos / partido" />
      </div>
      <div className="stats three">
        <Stat value={(t.to / gp).toFixed(1)} label="Pérdidas / partido" tone="danger" />
        <Stat value={t.to ? (t.ast / t.to).toFixed(2) : "—"} label="AST / pérdida" />
        <Stat value={(t.blk / gp).toFixed(1)} label="Tapas / partido" />
      </div>

      <h2>Puntos a favor y en contra por partido</h2>
      <p className="hint">Eje X: jornada y rival · Eje Y: puntos</p>
      <LineChart
        categories={gameCats}
        series={[
          { name: t.name, data: report.games.map((g) => g.us), color: INFO },
          { name: "Rival", data: report.games.map((g) => g.them), color: MUTED },
        ]}
      />

      <h2>Resultados</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Rival</th>
            <th>Condición</th>
            <th>Marcador</th>
            <th>Dif</th>
            <th>Res</th>
          </tr>
        </thead>
        <tbody>
          {report.games.map((g, i) => (
            <tr key={g.fileName + i} className={g.us > g.them ? "win" : "loss"}>
              <td>{i + 1}</td>
              <td>{g.opp}</td>
              <td>{locLabel(g.loc)}</td>
              <td>{`${g.us}–${g.them}`}</td>
              <td>{signed(g.us - g.them)}</td>
              <td>{g.us > g.them ? "G" : "P"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Plantel</h2>
      <p className="hint">
        {rosterCut > 1
          ? `Jugadores con ${rosterCut} o más partidos. Promedios por partido jugado.`
          : "Jugadores con minutos. Promedios por partido jugado."}
      </p>
      <div className="table-scroll">
        <table className="compact">
          <thead>
            <tr>
              <th>Jugador</th>
              <th>PJ</th>
              <th>Min</th>
              <th>Pts</th>
              <th>PPG</th>
              <th>2P</th>
              <th>3P</th>
              <th>TL</th>
              <th>REB</th>
              <th>AST</th>
              <th>STL</th>
              <th>VAL</th>
              <th>+/−</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((p) => (
              <tr key={p.key}>
                <td>{p.name}</td>
                <td>{p.gp}</td>
                <td>{p.min}</td>
                <td>{p.pts}</td>
                <td>{p.ppg.toFixed(1)}</td>
                <td>{shot(p.f2m, p.f2a, p.f2p)}</td>
                <td>{shot(p.f3m, p.f3a, p.f3p)}</td>
                <td>{shot(p.ftm, p.fta, p.ftp)}</td>
                <td>{`${p.reb} (${p.rpg})`}</td>
                <td>{p.ast}</td>
                <td>{p.stl}</td>
                <td>{p.val}</td>
                <td>{signed(p.pm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">
        +/− = diferencial de puntos del equipo mientras ese jugador está en cancha.
      </p>
    </div>
  );
}

function RankingsSection({
  rank,
  rankId,
  setRankId,
  leaders,
  report,
}: {
  rank: RankDef;
  rankId: string;
  setRankId: (id: string) => void;
  leaders: PlayerSeason[];
  report: SeasonReport;
}) {
  return (
    <div className="stack">
      <h2>Top 5 por estadística</h2>
      <p className="hint">{rank.note}.</p>
      <div className="pills wrap">
        {report.ranks.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`pill ${rankId === r.id ? "active" : ""}`}
            onClick={() => setRankId(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>
      <h3>{`Top 5 · ${rank.label}`}</h3>
      <HBar
        labels={leaders.map((p) => p.name.split(" ").slice(-1)[0] ?? p.name)}
        values={leaders.map((p) => chartValue(p, rank))}
        suffix={rank.suffix ?? (rank.isMin ? " min" : "")}
      />
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Jugador</th>
            <th>PJ</th>
            <th>Min</th>
            <th>{rank.label}</th>
            <th>Pts</th>
            <th>VAL</th>
          </tr>
        </thead>
        <tbody>
          {leaders.map((p, i) => (
            <tr key={p.key}>
              <td>{i + 1}</td>
              <td>{p.name}</td>
              <td>{p.gp}</td>
              <td>{p.min}</td>
              <td>{rankValue(p, rank)}</td>
              <td>{p.pts}</td>
              <td>{p.val}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayerSection({
  report,
  player,
  playerKey,
  setPlayerKey,
}: {
  report: SeasonReport;
  player: PlayerSeason;
  playerKey: string;
  setPlayerKey: (k: string) => void;
}) {
  const t = report.team;
  const sharePts = t.pf ? ((100 * player.pts) / t.pf).toFixed(1) : "0";
  const shareReb = t.reb ? ((100 * player.reb) / t.reb).toFixed(1) : "0";
  const pts2 = player.f2m * 2;
  const best = player.log.reduce((a, b) => (b.val > a.val ? b : a));

  return (
    <div className="stack">
      <div className="player-head">
        <div>
          <h2>{player.name}</h2>
          <p className="sub">
            {player.gp} {player.gp === 1 ? "partido" : "partidos"} · {player.mpg.toFixed(1)} min por
            noche
          </p>
        </div>
        <label className="team-select">
          Jugador
          <select value={playerKey} onChange={(e) => setPlayerKey(e.target.value)}>
            {report.players.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="stats">
        <Stat value={player.ppg.toFixed(1)} label="Puntos por partido" />
        <Stat value={player.rpg.toFixed(1)} label="Rebotes por partido" />
        <Stat value={player.f2p == null ? "—" : `${player.f2p.toFixed(1)}%`} label="% dobles" />
        <Stat value={signed(player.pm)} label="+/− acumulado" tone="ok" />
      </div>

      <div className="callout">
        <strong>Aporte al equipo</strong>
        <p>
          {sharePts}% de los puntos y {shareReb}% de los rebotes. {player.f3m}/{player.f3a} en triples.
          Mejor noche: {best.pts} pts / {best.reb} reb / VAL {best.val} vs {best.opp}.
        </p>
      </div>

      <h3>Totales</h3>
      <table>
        <thead>
          <tr>
            <th>Métrica</th>
            <th>Total</th>
            <th>Promedio</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Minutos</td>
            <td>{player.min}</td>
            <td>{player.mpg.toFixed(1)}</td>
          </tr>
          <tr>
            <td>Puntos</td>
            <td>{player.pts}</td>
            <td>{player.ppg.toFixed(1)}</td>
          </tr>
          <tr>
            <td>Dobles</td>
            <td>{shot(player.f2m, player.f2a, player.f2p)}</td>
            <td>{(player.f2m / player.gp).toFixed(1)} conv</td>
          </tr>
          <tr>
            <td>Triples</td>
            <td>{shot(player.f3m, player.f3a, player.f3p)}</td>
            <td>{(player.f3a / player.gp).toFixed(1)} int</td>
          </tr>
          <tr>
            <td>Libres</td>
            <td>{shot(player.ftm, player.fta, player.ftp)}</td>
            <td>{(player.ftm / player.gp).toFixed(1)} conv</td>
          </tr>
          <tr>
            <td>TC / eFG / TS</td>
            <td>{`${player.fgp ?? "—"}% / ${player.efg ?? "—"}% / ${player.ts ?? "—"}%`}</td>
            <td>—</td>
          </tr>
          <tr>
            <td>Rebotes</td>
            <td>{`${player.reb} (${player.defr}+${player.offr})`}</td>
            <td>{player.rpg.toFixed(1)}</td>
          </tr>
          <tr>
            <td>Asistencias</td>
            <td>{player.ast}</td>
            <td>{player.apg.toFixed(1)}</td>
          </tr>
          <tr>
            <td>Robos</td>
            <td>{player.stl}</td>
            <td>{(player.stl / player.gp).toFixed(1)}</td>
          </tr>
          <tr>
            <td>Pérdidas</td>
            <td>{player.to}</td>
            <td>{(player.to / player.gp).toFixed(1)}</td>
          </tr>
          <tr>
            <td>Tapas</td>
            <td>{player.blk}</td>
            <td>{(player.blk / player.gp).toFixed(1)}</td>
          </tr>
          <tr>
            <td>Valoración</td>
            <td>{player.val}</td>
            <td>{player.vpg.toFixed(1)}</td>
          </tr>
          <tr>
            <td>+/−</td>
            <td>{signed(player.pm)}</td>
            <td>{signed(Math.round(player.pm / player.gp))}</td>
          </tr>
        </tbody>
      </table>

      <div className="split">
        <div>
          <h3>Eficiencia vs equipo</h3>
          <HBar
            labels={["% 2P", "% 3P", "% TL", "% TC", "eFG%", "TS%"]}
            values={[
              player.f2p ?? 0,
              player.f3p ?? 0,
              player.ftp ?? 0,
              player.fgp ?? 0,
              player.efg ?? 0,
              player.ts ?? 0,
            ]}
            suffix="%"
          />
        </div>
        <div>
          <h3>Origen de sus puntos</h3>
          <Donut
            data={[
              { label: `Dobles ${pts2}`, value: pts2, color: INFO },
              { label: `Triples ${player.f3m * 3}`, value: player.f3m * 3, color: WARN },
              { label: `Libres ${player.ftm}`, value: player.ftm, color: MUTED },
            ].filter((d) => d.value > 0)}
          />
        </div>
      </div>

      <h3>Planilla</h3>
      <div className="table-scroll">
        <table className="compact">
          <thead>
            <tr>
              <th>#</th>
              <th>Rival</th>
              <th>Cond.</th>
              <th>Res</th>
              <th>Min</th>
              <th>Pts</th>
              <th>2P</th>
              <th>3P</th>
              <th>TL</th>
              <th>REB</th>
              <th>AST</th>
              <th>STL</th>
              <th>PER</th>
              <th>TAP</th>
              <th>VAL</th>
              <th>+/−</th>
            </tr>
          </thead>
          <tbody>
            {player.log.map((g, i) => (
              <tr key={g.opp + i}>
                <td>{i + 1}</td>
                <td>{g.opp}</td>
                <td>{locLabel(g.loc)}</td>
                <td>{`${g.us > g.them ? "G" : "P"} ${g.us}–${g.them}`}</td>
                <td>{g.min}</td>
                <td>{g.pts}</td>
                <td>{g.f2}</td>
                <td>{g.f3}</td>
                <td>{g.ft}</td>
                <td>{g.reb}</td>
                <td>{g.ast}</td>
                <td>{g.stl}</td>
                <td>{g.to}</td>
                <td>{g.blk}</td>
                <td>{g.val}</td>
                <td>{signed(g.pm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
