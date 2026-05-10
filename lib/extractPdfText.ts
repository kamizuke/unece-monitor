"use client";

export async function extractPdfText(file: File): Promise<{ text: string; pageCount: number }> {
  const buffer = await file.arrayBuffer();
  const bytes  = new Uint8Array(buffer);
  const raw    = new TextDecoder("latin1").decode(bytes);

  const pageCount = countPages(raw);
  const streams   = findStreams(raw);           // fast: scans only object headers
  const parts     = await decompressAll(streams); // parallel decompression

  // Also scan the raw doc for uncompressed BT/ET (handles simple PDFs)
  const rawParts: string[] = [];
  extractBtEt(raw, rawParts);
  parts.push(...rawParts);

  const text = [...new Set(parts)]
    .map(decodePdfString)
    .filter(s => s.trim().length > 1)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return { text, pageCount };
}

// ── Find stream data via "N M obj" markers ────────────────────────────────────
// PDF objects start with "N M obj". Scanning for this is far more specific
// than <<...>> and avoids thousands of false matches inside binary data.

interface StreamEntry { header: string; content: string }

function findStreams(raw: string): StreamEntry[] {
  const entries: StreamEntry[] = [];

  // Match each object header up to the stream keyword
  // "N M obj … /Length NNN … >> stream\n"
  const objRe = /\d+\s+\d+\s+obj\b([\s\S]{1,3000}?)stream\r?\n/g;
  let m: RegExpExecArray | null;

  while ((m = objRe.exec(raw)) !== null) {
    const header    = m[1];
    const dataStart = m.index + m[0].length;

    // Extract using explicit /Length (avoids reading binary data with regex)
    const lenMatch = header.match(/\/Length\s+(\d+)(?!\s+\d+\s*R\b)/);
    if (!lenMatch) continue;

    const length = parseInt(lenMatch[1], 10);
    if (length <= 0 || dataStart + length > raw.length) continue;

    entries.push({ header, content: raw.slice(dataStart, dataStart + length) });
  }

  return entries;
}

// ── Decompress all streams in parallel ────────────────────────────────────────

async function decompressAll(streams: StreamEntry[]): Promise<string[]> {
  const tasks = streams.map(({ header, content }) => processStream(header, content));
  const results = await Promise.all(tasks);
  return results.flat();
}

async function processStream(header: string, content: string): Promise<string[]> {
  const out: string[] = [];
  const isFlate   = /\/Filter\s*(?:\/FlateDecode|\[[\s\S]{0,80}\/FlateDecode[\s\S]{0,80}\])/.test(header);
  const isAscii85 = /\/Filter\s*(?:\/ASCII85Decode|\[[\s\S]{0,80}\/ASCII85Decode[\s\S]{0,80}\])/.test(header);
  const isHex     = /\/Filter\s*(?:\/ASCIIHexDecode|\[[\s\S]{0,80}\/ASCIIHexDecode[\s\S]{0,80}\])/.test(header);

  if (isFlate) {
    const text = await tryDecompress(content);
    if (text) extractBtEt(text, out);
  } else if (isAscii85) {
    const text = decodeAscii85(content);
    if (text) extractBtEt(text, out);
  } else if (isHex) {
    const text = decodeHex(content);
    if (text) extractBtEt(text, out);
  } else {
    extractBtEt(content, out);
  }

  return out;
}

// ── Decompression ─────────────────────────────────────────────────────────────

async function tryDecompress(latin1: string): Promise<string | null> {
  const buf = Uint8Array.from({ length: latin1.length }, (_, i) => latin1.charCodeAt(i));
  if (buf.length < 2) return null;

  // Only attempt if bytes look like a valid zlib or deflate stream
  const b0 = buf[0], b1 = buf[1];
  const isZlib = b0 === 0x78 && (b1 === 0x01 || b1 === 0x5E || b1 === 0x9C || b1 === 0xDA);

  for (const fmt of (isZlib ? ["deflate", "deflate-raw"] : ["deflate-raw"]) as CompressionFormat[]) {
    try {
      const ds     = new DecompressionStream(fmt);
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();

      await writer.write(buf);
      await writer.close();

      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value as Uint8Array);
      }

      const total = chunks.reduce((s, c) => s + c.length, 0);
      const out   = new Uint8Array(total);
      let   pos   = 0;
      for (const c of chunks) { out.set(c, pos); pos += c.length; }

      return new TextDecoder("latin1").decode(out);
    } catch { /* try next */ }
  }
  return null;
}

// ── Text extraction ───────────────────────────────────────────────────────────

function extractBtEt(text: string, out: string[]): void {
  const btEt = /BT\b([\s\S]*?)\bET\b/g;
  let block: RegExpExecArray | null;
  while ((block = btEt.exec(text)) !== null) {
    extractStrings(block[1], out);
  }
}

function extractStrings(content: string, out: string[]): void {
  // (string) Tj
  const tj = /\(([^)]*(?:\\.[^)]*)*)\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = tj.exec(content)) !== null) out.push(m[1]);

  // [(str) gap] TJ
  const tjArr = /\[([\s\S]*?)\]\s*TJ/g;
  while ((m = tjArr.exec(content)) !== null) {
    const inner = /\(([^)]*(?:\\.[^)]*)*)\)/g;
    let s: RegExpExecArray | null;
    while ((s = inner.exec(m[1])) !== null) out.push(s[1]);
  }

  // <hex> Tj  — handles CID/CMap fonts (common in modern PDFs)
  const tjHex = /<([0-9A-Fa-f]+)>\s*Tj/g;
  while ((m = tjHex.exec(content)) !== null) {
    out.push(hexToText(m[1]));
  }

  // [<hex> gap] TJ
  const tjHexArr = /\[([\s\S]*?)\]\s*TJ/g;
  while ((m = tjHexArr.exec(content)) !== null) {
    const hexInner = /<([0-9A-Fa-f]+)>/g;
    let h: RegExpExecArray | null;
    while ((h = hexInner.exec(m[1])) !== null) out.push(hexToText(h[1]));
  }
}

function hexToText(hex: string): string {
  // Try UTF-16BE (4 hex chars per char, common in Adobe PDFs)
  if (hex.length % 4 === 0 && hex.length >= 4) {
    let s = "";
    for (let i = 0; i < hex.length; i += 4) {
      const cp = parseInt(hex.slice(i, i + 4), 16);
      if (cp > 31) s += String.fromCodePoint(cp);
    }
    if (s.trim()) return s;
  }
  // Single-byte fallback
  let s = "";
  for (let i = 0; i < hex.length; i += 2) {
    const b = parseInt(hex.slice(i, i + 2), 16);
    if (b > 31 && b < 128) s += String.fromCharCode(b);
  }
  return s;
}

// ── Minor helpers ─────────────────────────────────────────────────────────────

function countPages(raw: string): number {
  const m = raw.match(/\/Count\s+(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}

function decodeAscii85(s: string): string | null {
  try {
    const clean = s.replace(/\s/g, "").replace(/~>$/, "");
    const bytes: number[] = [];
    let i = 0;
    while (i < clean.length) {
      if (clean[i] === "z") { bytes.push(0, 0, 0, 0); i++; continue; }
      const g   = clean.slice(i, i + 5).padEnd(5, "u");
      let   val = 0;
      for (const c of g) val = val * 85 + (c.charCodeAt(0) - 33);
      const n = Math.min(4, clean.length - i);
      for (let j = 0; j < n; j++) bytes.push((val >>> (24 - j * 8)) & 0xff);
      i += 5;
    }
    return new TextDecoder("latin1").decode(new Uint8Array(bytes));
  } catch { return null; }
}

function decodeHex(s: string): string | null {
  try {
    const clean = s.replace(/\s/g, "").replace(/>$/, "");
    const bytes = new Uint8Array(Math.ceil(clean.length / 2));
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    return new TextDecoder("latin1").decode(bytes);
  } catch { return null; }
}

function decodePdfString(s: string): string {
  return s
    .replace(/\\n/g, " ").replace(/\\r/g, " ").replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\")
    .replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
}
