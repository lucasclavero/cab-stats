import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { topPlayers } from "./aggregate";
import { fmtPct, locLabel, shot, signed } from "./format";
import type { PlayerSeason, RankDef, SeasonReport } from "../types";

const INK: [number, number, number] = [26, 26, 26];
const MUTED: [number, number, number] = [85, 85, 85];
const LINE: [number, number, number] = [229, 229, 229];
const WIN: [number, number, number] = [29, 92, 46];
const LOSS: [number, number, number] = [138, 31, 31];

function gpLabel(n: number, won: number, lost: number): string {
  const games = `${n} ${n === 1 ? "partido" : "partidos"}`;
  const w = `${won} ${won === 1 ? "ganado" : "ganados"}`;
  const l = `${lost} ${lost === 1 ? "perdido" : "perdidos"}`;
  return `${games} · ${w}, ${l}`;
}

function rankCell(p: PlayerSeason, def: RankDef): string {
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

function fileSlug(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "equipo"}-CABB-2026.pdf`;
}

function finalY(doc: jsPDF, fallback: number): number {
  const last = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable;
  return last?.finalY ?? fallback;
}

function tableOpts() {
  return {
    theme: "plain" as const,
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 2,
      textColor: INK,
      lineColor: LINE,
      lineWidth: 0.15,
      overflow: "linebreak" as const,
    },
    headStyles: {
      fillColor: [255, 255, 255] as [number, number, number],
      textColor: MUTED,
      fontStyle: "bold" as const,
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: {
      0: { halign: "left" as const },
      1: { halign: "left" as const },
    },
  };
}

function ensureSpace(doc: jsPDF, y: number, need: number, margin: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + need < pageH - 16) return y;
  doc.addPage();
  return margin + 2;
}

export async function exportReportPdf(report: SeasonReport): Promise<void> {
  const t = report.team;
  const gp = Math.max(t.gp, 1);
  const fga = t.f2a + t.f3a;
  const fgm = t.f2m + t.f3m;
  const pts2 = t.f2m * 2;
  const pts3 = t.f3m * 3;
  const efg = fga ? (100 * (t.f2m + 1.5 * t.f3m)) / fga : 0;
  const tsDen = 2 * (fga + 0.44 * t.fta);
  const ts = tsDen > 0 ? (100 * t.pf) / tsDen : 0;
  const ppg = t.pf / gp;
  const papg = t.pa / gp;
  const share2 = t.pf ? Math.round((100 * pts2) / t.pf) : 0;
  const share3 = t.pf ? Math.round((100 * pts3) / t.pf) : 0;
  const shareFt = t.pf ? Math.round((100 * t.ftm) / t.pf) : 0;
  const astTo = t.to ? t.ast / t.to : 0;
  const roster = report.players.filter((p) => p.sec > 0);
  const margin = 12;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text(t.name, margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`MM Flex Superior CABB 2026 · ${gpLabel(t.gp, t.w, t.l)}`, margin, y);
  y += 8;

  const cards = [
    [`${t.w}–${t.l}`, "Récord"],
    [ppg.toFixed(1), "Puntos por partido"],
    [papg.toFixed(1), "Puntos en contra"],
    [`${signed(t.pf - t.pa)}`, `Diferencia total (${t.pf}–${t.pa})`],
  ];
  const cardW = (pageW - margin * 2 - 9) / 4;
  cards.forEach((card, i) => {
    const x = margin + i * (cardW + 3);
    doc.setDrawColor(221, 221, 221);
    doc.roundedRect(x, y, cardW, 16, 1, 1);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(card[0], x + 3, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(doc.splitTextToSize(card[1], cardW - 5), x + 3, y + 12);
  });
  y += 20;

  const profile =
    `El equipo anota ${ppg.toFixed(1)} y recibe ${papg.toFixed(1)}. El triple (${fmtPct(t.f3m, t.f3a)}) es el punto flojo; ` +
    `los libres (${fmtPct(t.ftm, t.fta)}) sostienen. Hay ${(t.to / gp).toFixed(1)} pérdidas por partido frente a ${(t.ast / gp).toFixed(1)} asistencias.`;
  const profileLines = doc.splitTextToSize(profile, pageW - margin * 2 - 8) as string[];
  const profileH = 8 + profileLines.length * 4;
  doc.setFillColor(244, 244, 244);
  doc.rect(margin, y, pageW - margin * 2, profileH, "F");
  doc.setFillColor(...INK);
  doc.rect(margin, y, 1.2, profileH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text("Perfil ofensivo", margin + 4, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(profileLines, margin + 4, y + 10);
  y += profileH + 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text("1. Estadísticas generales del equipo", margin, y);
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.4);
  doc.line(margin, y + 2, pageW - margin, y + 2);
  y += 8;

  const half = (pageW - margin * 2 - 8) / 2;
  autoTable(doc, {
    ...tableOpts(),
    startY: y,
    margin: { left: margin, right: pageW - margin - half },
    tableWidth: half,
    head: [["Tipo", "Conv/Int", "%", "Puntos"]],
    body: [
      ["Dobles", `${t.f2m}/${t.f2a}`, fmtPct(t.f2m, t.f2a), String(pts2)],
      ["Triples", `${t.f3m}/${t.f3a}`, fmtPct(t.f3m, t.f3a), String(pts3)],
      ["Libres", `${t.ftm}/${t.fta}`, fmtPct(t.ftm, t.fta), String(t.ftm)],
      ["Campo", `${fgm}/${fga}`, fmtPct(fgm, fga), String(pts2 + pts3)],
    ],
  });
  const leftY = finalY(doc, y);

  autoTable(doc, {
    ...tableOpts(),
    startY: y,
    margin: { left: margin + half + 8, right: margin },
    tableWidth: half,
    head: [["Métrica", "Total", "Por partido"]],
    body: [
      ["Rebotes (def/of)", `${t.reb} (${t.defr}/${t.offr})`, (t.reb / gp).toFixed(1)],
      ["Asistencias", String(t.ast), (t.ast / gp).toFixed(1)],
      ["Robos", String(t.stl), (t.stl / gp).toFixed(1)],
      ["Pérdidas", String(t.to), (t.to / gp).toFixed(1)],
      ["AST / pérdida", astTo ? astTo.toFixed(2) : "—", "—"],
      ["Tapas", String(t.blk), (t.blk / gp).toFixed(1)],
    ],
  });
  y = Math.max(leftY, finalY(doc, y)) + 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    `eFG ${efg.toFixed(1)}% · TS ${ts.toFixed(1)}% · ${share2}% de los puntos salen de dobles, ${share3}% de triples, ${shareFt}% de libres.`,
    margin,
    y,
  );
  y += 7;

  autoTable(doc, {
    ...tableOpts(),
    startY: y,
    margin: { left: margin, right: margin },
    head: [["#", "Rival", "Condición", "Marcador", "Dif", "Res"]],
    body: report.games.map((g, i) => [
      String(i + 1),
      g.opp,
      locLabel(g.loc),
      `${g.us}–${g.them}`,
      signed(g.us - g.them),
      g.us > g.them ? "G" : "P",
    ]),
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 5) {
        data.cell.styles.textColor = data.cell.raw === "G" ? WIN : LOSS;
        data.cell.styles.fontStyle = data.cell.raw === "G" ? "bold" : "normal";
      }
    },
  });
  y = finalY(doc, y) + 8;

  y = ensureSpace(doc, y, 24, margin);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text("Plantel", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    "Jugadores con minutos en al menos un partido. Ordenado por minutos. Promedios por partido jugado.",
    margin,
    y,
  );
  y += 3;

  autoTable(doc, {
    ...tableOpts(),
    startY: y,
    margin: { left: margin, right: margin },
    styles: { ...tableOpts().styles, fontSize: 7.5, cellPadding: 1.4 },
    headStyles: { ...tableOpts().headStyles, fontSize: 7 },
    head: [["Jugador", "PJ", "Min", "Pts", "PPG", "2P", "3P", "TL", "REB", "AST", "STL", "VAL", "+/-"]],
    body: roster.map((p) => [
      p.name,
      String(p.gp),
      p.min,
      String(p.pts),
      p.ppg.toFixed(1),
      shot(p.f2m, p.f2a, p.f2p),
      shot(p.f3m, p.f3a, p.f3p),
      shot(p.ftm, p.fta, p.ftp),
      `${p.reb} (${p.rpg})`,
      String(p.ast),
      String(p.stl),
      String(p.val),
      signed(p.pm),
    ]),
  });
  y = finalY(doc, y) + 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    "+/- = diferencial de puntos del equipo mientras ese jugador está en cancha (no son puntos personales).",
    margin,
    y,
  );

  doc.addPage();
  y = 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text("2. Top 5 por estadística", margin, y);
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.4);
  doc.line(margin, y + 2, pageW - margin, y + 2);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const rankIntro =
    t.gp <= 5
      ? `Con ${t.gp} partidos, los porcentajes piden un mínimo de intentos más bajo que en un recorte largo, para no premiar muestras de 1 o 2 tiros.`
      : "Los porcentajes piden un mínimo de intentos para no premiar muestras chicas.";
  const introLines = doc.splitTextToSize(rankIntro, pageW - margin * 2) as string[];
  doc.text(introLines, margin, y);
  y += introLines.length * 4 + 4;

  for (const def of report.ranks) {
    const leaders = topPlayers(report.players, def);
    if (!leaders.length) continue;
    y = ensureSpace(doc, y, 36, margin);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(`Top 5 · ${def.label}`, margin, y);
    y += 4;
    if (def.note) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(def.note, margin, y);
      y += 3;
    }
    autoTable(doc, {
      ...tableOpts(),
      startY: y,
      margin: { left: margin, right: margin },
      head: [["#", "Jugador", "PJ", "Min", def.label, "Pts", "VAL"]],
      body: leaders.map((p, i) => [
        String(i + 1),
        p.name,
        String(p.gp),
        p.min,
        rankCell(p, def),
        String(p.pts),
        String(p.val),
      ]),
    });
    y = finalY(doc, y) + 7;
  }

  y = ensureSpace(doc, y, 12, margin);
  const opps = [...new Set(report.games.map((g) => g.opp))].join(", ");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(119, 119, 119);
  doc.text(
    doc.splitTextToSize(
      `Fuente: planillas CABB · MM Flex Superior 2026 · ${t.gp} ${t.gp === 1 ? "partido" : "partidos"} (${opps}).`,
      pageW - margin * 2,
    ),
    margin,
    y,
  );

  doc.save(fileSlug(t.name));
}
