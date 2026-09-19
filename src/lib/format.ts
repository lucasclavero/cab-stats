export function parseMin(value: string): number {
  const m = String(value).trim().match(/^(\d{1,3}):(\d{2})$/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function fmtMin(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function parseShot(value: unknown): { m: number; a: number } {
  const s = String(value ?? "").trim();
  const m = s.match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
  if (!m) return { m: 0, a: 0 };
  return { m: Number(m[1]), a: Number(m[2]) };
}

export function num(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = String(value ?? "").trim().replace(",", ".");
  if (!s || s === "—") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function pct(m: number, a: number): number | null {
  if (a === 0) return null;
  return Math.round((1000 * m) / a) / 10;
}

export function fmtPct(m: number, a: number): string {
  const p = pct(m, a);
  return p == null ? "—" : `${p.toFixed(1)}%`;
}

export function shot(m: number, a: number, p: number | null): string {
  return `${m}/${a}  ${p == null ? "—" : `${p.toFixed(1)}%`}`;
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

export function prettyPerson(raw: string): string {
  const cleaned = raw.replace(/\*/g, "").replace(/\(CAP\)/gi, "").trim();
  const compact = cleaned.replace(/\s+/g, " ");
  if (compact.includes(",")) {
    const [last, first] = compact.split(",", 2);
    const firstPart = (first ?? "").trim().split(/\s+/)[0] ?? "";
    return `${titleWord(firstPart)} ${titleLast(last)}`.trim();
  }
  return compact
    .split(/\s+/)
    .map((w, i) => (i === 0 ? titleWord(w) : w.toLowerCase() === "de" ? "de" : titleWord(w)))
    .join(" ");
}

function titleWord(w: string): string {
  if (!w) return w;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function titleLast(w: string): string {
  return w
    .trim()
    .split(/\s+/)
    .map((part) => titleWord(part))
    .join(" ");
}

export function prettyTeam(raw: string): string {
  const small = new Set(["Y", "DE", "DEL", "LA", "EL", "LOS", "LAS", "VS"]);
  return raw
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w, i) => {
      const u = w.toUpperCase();
      if (i > 0 && small.has(u)) return u.toLowerCase();
      return titleWord(w);
    })
    .join(" ");
}

export function normName(raw: string): string {
  return prettyPerson(raw)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function locLabel(loc: "L" | "V"): string {
  return loc === "L" ? "Local" : "Visita";
}

export function teamKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export function teamMatch(a: string, b: string): boolean {
  const ka = teamKey(a);
  const kb = teamKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  return ka.includes(kb) || kb.includes(ka);
}

export function stripLeagueSuffix(name: string): string {
  let s = name.replace(/\s+/g, " ").trim();
  s = s.replace(/\s*[-–]\s*MM\b[\s\S]*$/i, "");
  s = s.replace(/\s+MM\s+FLEX\b[\s\S]*$/i, "");
  s = s.replace(/\s+MM\s+SUPERIOR\b[\s\S]*$/i, "");
  s = s.replace(/\s+FLEX\s+SUPERIOR\b[\s\S]*$/i, "");
  s = s.replace(/\s+SUPERIOR\s+CABB\b[\s\S]*$/i, "");
  s = s.replace(/\s+CABB\s+\d{4}[\s\S]*$/i, "");
  s = s.replace(/\s+MM$/i, "");
  return s.replace(/\s+/g, " ").trim();
}

export function splitTitle(title: string): [string, string] | null {
  const cleaned = title
    .replace(/^Estad[ií]sticas\s*/i, "")
    .replace(/^[-–]\s*/, "")
    .trim();
  const parts = cleaned.split(/\s+vs\s+/i);
  if (parts.length < 2) return null;
  const home = stripLeagueSuffix(parts[0]);
  const away = stripLeagueSuffix(parts[1]);
  if (!home || !away) return null;
  return [home, away];
}
