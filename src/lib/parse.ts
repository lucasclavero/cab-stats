import { parsePdf } from "./parsePdf";
import { parseXlsx } from "./parseXlsx";
import type { ParsedGame } from "../types";

export async function parseFile(file: File): Promise<ParsedGame> {
  const buf = await file.arrayBuffer();
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return parsePdf(buf, file.name);
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return parseXlsx(buf, file.name);
  throw new Error(`Formato no soportado: ${file.name}`);
}

export { parsePdf, parseXlsx };
