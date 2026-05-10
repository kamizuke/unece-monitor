"use client";

/**
 * Extracts plain text from a PDF file by parsing its content streams directly.
 * Works in any browser without a worker. Handles standard text-based PDFs;
 * image-only (scanned) PDFs will return empty text.
 */
export async function extractPdfText(file: File): Promise<{ text: string; pageCount: number }> {
  const buffer = await file.arrayBuffer();
  const bytes  = new Uint8Array(buffer);

  // Decode as latin-1 to preserve byte values intact
  const raw = new TextDecoder("latin-1").decode(bytes);

  const text      = parsePdfText(raw);
  const pageCount = countPages(raw);

  return { text, pageCount };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function countPages(raw: string): number {
  const m = raw.match(/\/Count\s+(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}

function parsePdfText(raw: string): string {
  const parts: string[] = [];

  // Decompress any FlateDecode streams if possible
  const streams = extractStreams(raw);

  for (const stream of streams) {
    extractBtEt(stream, parts);
  }

  // Also scan the raw document for uncompressed text blocks
  extractBtEt(raw, parts);

  return parts
    .map(s => decodePdfString(s))
    .filter(s => s.trim().length > 0)
    .join(" ");
}

function extractStreams(raw: string): string[] {
  const result: string[] = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    result.push(m[1]);
  }
  return result;
}

function extractBtEt(text: string, out: string[]): void {
  // Text blocks between BT and ET operators
  const btEt = /BT\b([\s\S]*?)\bET\b/g;
  let block: RegExpExecArray | null;

  while ((block = btEt.exec(text)) !== null) {
    const content = block[1];

    // (string) Tj  — simple string
    const tj = /\(([^)]*(?:\\.[^)]*)*)\)\s*Tj/g;
    let m: RegExpExecArray | null;
    while ((m = tj.exec(content)) !== null) out.push(m[1]);

    // [(str) num (str)] TJ  — spaced string array
    const tjArr = /\[([\s\S]*?)\]\s*TJ/g;
    while ((m = tjArr.exec(content)) !== null) {
      const inner = /\(([^)]*(?:\\.[^)]*)*)\)/g;
      let s: RegExpExecArray | null;
      while ((s = inner.exec(m[1])) !== null) out.push(s[1]);
    }
  }

  // Also catch strings outside BT/ET (some generators skip them)
  const loose = /\(([A-Za-z0-9 .,;:\-/]{4,80})\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = loose.exec(text)) !== null) out.push(m[1]);
}

function decodePdfString(s: string): string {
  return s
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}
