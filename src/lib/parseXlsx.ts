import * as XLSX from "xlsx";
import type { ParsedGame, PlayerBox, TeamBox } from "../types";
import { num, parseMin, parseShot, prettyPerson, prettyTeam, splitTitle } from "./format";

const HEADER_MARKERS = new Set(["nombre", "num.", "num", "min", "pts"]);

function cell(row: unknown[], i: number): string {
  const v = row[i];
  if (v == null || v === "") return "";
  return String(v).trim();
}

function isHeaderRow(row: unknown[]): boolean {
  const b = cell(row, 1).toLowerCase();
  const a = cell(row, 0).toLowerCase();
  return b === "nombre" || a === "nombre";
}

function isTotalsRow(row: unknown[]): boolean {
  return cell(row, 0).toUpperCase() === "TOTALES" || cell(row, 1).toUpperCase() === "TOTALES";
}

function looksLikeTeamName(row: unknown[]): boolean {
  const a = cell(row, 0);
  if (!a || a.length < 3) return false;
  if (isHeaderRow(row) || isTotalsRow(row)) return false;
  if (/estad[ií]sticas/i.test(a) || /\svs\s/i.test(a) || /confeder/i.test(a)) return false;
  const rest = row.slice(1, 8).every((c) => c == null || String(c).trim() === "");
  const hasMin = /\d+:\d{2}/.test(cell(row, 2));
  return rest && !hasMin && /[A-ZÁÉÍÓÚÑ]{3,}/.test(a);
}

function parsePlayerRow(row: unknown[]): PlayerBox | null {
  const nameCell = cell(row, 1);
  const minCell = cell(row, 2);
  if (!nameCell || nameCell.toLowerCase() === "nombre") return null;
  if (!/\d+:\d{2}/.test(minCell)) return null;
  const f2 = parseShot(row[4]);
  const f3 = parseShot(row[6]);
  const ft = parseShot(row[8]);
  return {
    jersey: cell(row, 0),
    rawName: nameCell,
    name: prettyPerson(nameCell),
    min: minCell,
    sec: parseMin(minCell),
    pts: num(row[3]),
    f2m: f2.m,
    f2a: f2.a,
    f3m: f3.m,
    f3a: f3.a,
    ftm: ft.m,
    fta: ft.a,
    defr: num(row[10]),
    offr: num(row[11]),
    reb: num(row[12]) || num(row[10]) + num(row[11]),
    ast: num(row[13]),
    stl: num(row[14]),
    to: num(row[15]),
    blk: num(row[16]),
    tr: num(row[17]),
    fc: num(row[18]),
    fr: num(row[19]),
    val: num(row[20]),
    pm: num(row[21]),
  };
}

function findTitle(rows: unknown[][]): string {
  for (const row of rows) {
    for (const c of row) {
      const s = String(c ?? "");
      if (/estad[ií]sticas/i.test(s) && /vs/i.test(s)) return s;
    }
  }
  return "";
}

export function parseXlsx(buffer: ArrayBuffer, fileName: string): ParsedGame {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
  }) as unknown[][];

  const title = findTitle(rows);
  const split = splitTitle(title);
  const teamStarts: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (looksLikeTeamName(rows[i])) teamStarts.push(i);
  }

  if (teamStarts.length < 2) {
    throw new Error(`No encontré dos equipos en ${fileName}`);
  }

  const teams: TeamBox[] = [];
  for (let t = 0; t < 2; t++) {
    const start = teamStarts[t];
    const end = t + 1 < teamStarts.length ? teamStarts[t + 1] : rows.length;
    const rawName = cell(rows[start], 0);
    const players: PlayerBox[] = [];
    for (let i = start + 1; i < end; i++) {
      const row = rows[i];
      if (isTotalsRow(row) || isHeaderRow(row)) continue;
      if (HEADER_MARKERS.has(cell(row, 0).toLowerCase())) continue;
      const player = parsePlayerRow(row);
      if (player && player.sec >= 0) players.push(player);
    }
    teams.push({
      name: rawName,
      displayName: prettyTeam(rawName),
      players,
    });
  }

  const home = split?.[0] ?? teams[0].name;
  const away = split?.[1] ?? teams[1].name;

  return {
    fileName,
    title: title || fileName,
    home,
    away,
    homeDisplay: prettyTeam(home),
    awayDisplay: prettyTeam(away),
    teams,
  };
}
