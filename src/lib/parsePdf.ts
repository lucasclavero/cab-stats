import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { ParsedGame, PlayerBox, TeamBox } from "../types";
import { num, parseMin, parseShot, prettyPerson, prettyTeam, splitTitle, teamMatch } from "./format";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

type TextItem = { str: string; x: number; y: number };

async function extractLines(buffer: ArrayBuffer): Promise<string[]> {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items: TextItem[] = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const t = item.transform;
      items.push({ str: item.str, x: t[4], y: Math.round(t[5] * 2) / 2 });
    }
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    let currentY = items[0]?.y ?? 0;
    let buf: TextItem[] = [];
    const flush = () => {
      if (!buf.length) return;
      buf.sort((a, b) => a.x - b.x);
      const text = buf
        .map((i) => i.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) lines.push(text);
      buf = [];
    };
    for (const it of items) {
      if (Math.abs(it.y - currentY) > 3) {
        flush();
        currentY = it.y;
      }
      buf.push(it);
    }
    flush();
  }
  return lines;
}

const PLAYER_RE =
  /^(\d+)\s+\*?(.+?)\s+(\d{1,3}:\d{2})\s+(-?\d+)\s+(\d+\/\d+)\s+(-?\d+)\s+(\d+\/\d+)\s+(-?\d+)\s+(\d+\/\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/;

function parsePlayerLine(line: string): PlayerBox | null {
  const compact = line.replace(/\s+/g, " ").trim();
  let m = compact.match(PLAYER_RE);
  if (!m) {
    const loose = compact.replace(/(\d+\/\d+)(\d{1,3})(?=\s)/g, "$1 $2");
    m = loose.match(PLAYER_RE);
  }
  if (!m) return null;
  const f2 = parseShot(m[5]);
  const f3 = parseShot(m[7]);
  const ft = parseShot(m[9]);
  return {
    jersey: m[1],
    rawName: m[2].replace(/\*$/, "").replace(/\(CAP\)/i, "").trim(),
    name: prettyPerson(m[2]),
    min: m[3],
    sec: parseMin(m[3]),
    pts: num(m[4]),
    f2m: f2.m,
    f2a: f2.a,
    f3m: f3.m,
    f3a: f3.a,
    ftm: ft.m,
    fta: ft.a,
    defr: num(m[11]),
    offr: num(m[12]),
    reb: num(m[13]) || num(m[11]) + num(m[12]),
    ast: num(m[14]),
    stl: num(m[15]),
    to: num(m[16]),
    blk: num(m[17]),
    tr: num(m[18]),
    fc: num(m[19]),
    fr: num(m[20]),
    val: num(m[21]),
    pm: num(m[22]),
  };
}

function isLeagueNoise(line: string): boolean {
  const n = line.replace(/\s+/g, " ").trim().toUpperCase();
  if (/CONFEDER/.test(n)) return true;
  if (/\bCABB\b/.test(n)) return true;
  if (/\bSUPERIOR\b/.test(n)) return true;
  if (/^MM\b/.test(n)) return true;
  if (/^FLEX\s+SUPERIOR/.test(n)) return true;
  if (/ESTAD[IÍ]STICAS/.test(n)) return true;
  if (/^\d{4}$/.test(n)) return true;
  return false;
}

function looksLikeTeamHeader(line: string): boolean {
  const t = line.replace(/\s+/g, " ").trim();
  if (t.length < 3 || t.length > 90) return false;
  if (isLeagueNoise(t)) return false;
  if (/^(entrenador|total(?:es)?|nombre|tc)\b/i.test(t)) return false;
  if (/\d+:\d{2}/.test(t) || /\d+\s*\/\s*\d+/.test(t)) return false;
  if (!/^[A-ZÁÉÍÓÚÑ0-9 .,'*&()/-]+$/i.test(t)) return false;
  return /[A-ZÁÉÍÓÚÑ]{2,}/i.test(t);
}

function findTitle(lines: string[]): string {
  const start = lines.findIndex((l) => /estad[ií]sticas/i.test(l));
  if (start < 0) return "";
  const parts = [lines[start]];
  for (let i = start + 1; i < Math.min(lines.length, start + 4); i++) {
    const l = lines[i];
    if (/^entrenador\b/i.test(l) || /^(nombre|tc)\b/i.test(l)) break;
    if (parsePlayerLine(l)) break;
    if (looksLikeTeamHeader(l) && /^entrenador\b/i.test(lines[i + 1] ?? "")) break;
    parts.push(l);
    const joined = parts.join(" ");
    if (/\bvs\b/i.test(joined) && /\bCABB\b/i.test(joined)) break;
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function pickTwoTeams(teams: TeamBox[], home: string, away: string): TeamBox[] {
  const withPlayers = teams.filter((t) => t.players.some((p) => p.sec > 0 || p.pts > 0));
  const pool = withPlayers.length >= 2 ? withPlayers : teams;
  const h = pool.find((t) => teamMatch(t.name, home) || teamMatch(t.displayName, home));
  const a = pool.find((t) => t !== h && (teamMatch(t.name, away) || teamMatch(t.displayName, away)));
  if (h && a) return [h, a];
  return pool.slice(0, 2);
}

export function parsePdfLines(lines: string[], fileName: string): ParsedGame {
  const titleLine = findTitle(lines);
  const split = splitTitle(titleLine.replace(/\s+/g, " "));
  const teams: TeamBox[] = [];
  let current: TeamBox | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1] ?? "";
    if (looksLikeTeamHeader(line) && /^entrenador\b/i.test(next.trim())) {
      const name = line.replace(/\s+/g, " ").trim();
      const existing = teams.find((t) => teamMatch(t.name, name));
      if (existing) {
        current = existing;
      } else {
        current = { name, displayName: prettyTeam(name), players: [] };
        teams.push(current);
      }
      continue;
    }
    if (!current) continue;
    if (/^total(es)?\b/i.test(line)) continue;
    const player = parsePlayerLine(line);
    if (player) current.players.push(player);
  }

  const chosen = pickTwoTeams(teams, split?.[0] ?? "", split?.[1] ?? "");
  if (chosen.length < 2) {
    throw new Error(`No encontré dos equipos en el PDF ${fileName}`);
  }

  const home = split?.[0] ?? chosen[0].name;
  const away = split?.[1] ?? chosen[1].name;

  return {
    fileName,
    title: titleLine || fileName,
    home,
    away,
    homeDisplay: prettyTeam(home),
    awayDisplay: prettyTeam(away),
    teams: chosen,
  };
}

export async function parsePdf(buffer: ArrayBuffer, fileName: string): Promise<ParsedGame> {
  const lines = await extractLines(buffer);
  return parsePdfLines(lines, fileName);
}
