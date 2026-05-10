"use client";

const MAX_STREAMS   = 60;   // never process more than 60 streams per PDF
const TIMEOUT_MS    = 15_000; // give up after 15 s

export async function extractPdfText(file: File): Promise<{ text: string; pageCount: number }> {
  // Yield to browser so the "Procesando..." UI renders before we block
  await tick();

  const buffer = await file.arrayBuffer();
  const bytes  = new Uint8Array(buffer);
  const raw    = latin1(bytes);

  const pageCount = countPages(raw);

  // Find content streams only (skip images, fonts, metadata)
  const streams = findContentStreams(raw);

  // Decompress in parallel with an overall timeout
  const parts = await withTimeout(decompressAll(streams), TIMEOUT_MS);

  // Also scan raw doc for uncompressed BT/ET (catches simple PDFs instantly)
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

// ── Fast helpers ──────────────────────────────────────────────────────────────

function tick(): Promise<void> {
  return new Promise(r => setTimeout(r, 0));
}

function withTimeout<T extends string[]>(p: Promise<T>, ms: number): Promise<T> {
  const fallback = new Promise<T>(r => setTimeout(() => r([] as unknown as T), ms));
  return Promise.race([p, fallback]);
}

/** Bijective byte→char using latin1 (charCodeAt recovers exact byte) */
function latin1(bytes: Uint8Array): string {
  // Process in 64KB chunks to avoid call-stack overflow on large PDFs
  const CHUNK = 65536;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return parts.join("");
}

/** Convert latin1 string back to exact bytes (faster than Uint8Array.from+callback) */
function toBytes(s: string): Uint8Array {
  const buf = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) buf[i] = s.charCodeAt(i);
  return buf;
}

// ── Stream discovery ──────────────────────────────────────────────────────────

interface Stream { header: string; content: string }

/**
 * Find content streams using "N M obj" markers (rare in compressed binary data).
 * Skip image/font/metadata streams — they contain no readable text.
 */
function findContentStreams(raw: string): Stream[] {
  const SKIP = /\/Subtype\s*\/Image|\/Type\s*\/Font|\/Type\s*\/Metadata|\/Type\s*\/XRef|\/Type\s*\/ObjStm/;

  const results: Stream[] = [];
  const re = /\d+\s+\d+\s+obj\b([\s\S]{1,2500}?)stream\r?\n/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(raw)) !== null && results.length < MAX_STREAMS) {
    const header    = m[1];
    const dataStart = m.index + m[0].length;

    if (SKIP.test(header)) continue;  // skip non-text streams

    const lenMatch = header.match(/\/Length\s+(\d+)(?!\s+\d+\s*R\b)/);
    if (!lenMatch) continue;

    const length = parseInt(lenMatch[1], 10);
    if (length <= 0 || length > 5_000_000 || dataStart + length > raw.length) continue;

    results.push({ header, content: raw.slice(dataStart, dataStart + length) });
  }

  return results;
}

// ── Parallel decompression ────────────────────────────────────────────────────

async function decompressAll(streams: Stream[]): Promise<string[]> {
  const results = await Promise.all(streams.map(s => processStream(s.header, s.content)));
  return results.flat();
}

async function processStream(header: string, content: string): Promise<string[]> {
  const out: string[] = [];
  const isFlate   = /\/Filter\s*(?:\/FlateDecode|\[[\s\S]{0,80}\/FlateDecode[\s\S]{0,80}\])/.test(header);
  const isAscii85 = /\/Filter\s*(?:\/ASCII85Decode|\[[\s\S]{0,80}\/ASCII85Decode[\s\S]{0,80}\])/.test(header);
  const isHex     = /\/Filter\s*(?:\/ASCIIHexDecode|\[[\s\S]{0,80}\/ASCIIHexDecode[\s\S]{0,80}\])/.test(header);

  if (isFlate) {
    const text = await decompress(content);
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

async function decompress(latin1Content: string): Promise<string | null> {
  const buf = toBytes(latin1Content);
  if (buf.length < 2) return null;

  const b0 = buf[0], b1 = buf[1];
  const isZlib = b0 === 0x78 && (b1 === 0x01 || b1 === 0x5E || b1 === 0x9C || b1 === 0xDA);
  const formats = (isZlib ? ["deflate", "deflate-raw"] : ["deflate-raw"]) as CompressionFormat[];

  for (const fmt of formats) {
    try {
      const ds     = new DecompressionStream(fmt);
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();
      await writer.write(buf as unknown as Uint8Array<ArrayBuffer>);
      await writer.close();

      const chunks: Uint8Array<ArrayBuffer>[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value as Uint8Array<ArrayBuffer>);
      }

      const total = chunks.reduce((s, c) => s + c.length, 0);
      const out   = new Uint8Array(total);
      let   pos   = 0;
      for (const c of chunks) { out.set(c, pos); pos += c.length; }
      return latin1(out);
    } catch { /* next format */ }
  }
  return null;
}

// ── BT/ET text extraction ─────────────────────────────────────────────────────

function extractBtEt(text: string, out: string[]): void {
  const re = /BT\b([\s\S]*?)\bET\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) extractStrings(m[1], out);
}

function extractStrings(block: string, out: string[]): void {
  let m: RegExpExecArray | null;

  // (string) Tj
  const tj = /\(([^)]*(?:\\.[^)]*)*)\)\s*Tj/g;
  while ((m = tj.exec(block)) !== null) out.push(m[1]);

  // [(str)...] TJ
  const tjA = /\[([\s\S]*?)\]\s*TJ/g;
  while ((m = tjA.exec(block)) !== null) {
    const inner = /\(([^)]*(?:\\.[^)]*)*)\)/g;
    let s: RegExpExecArray | null;
    while ((s = inner.exec(m[1])) !== null) out.push(s[1]);
  }

  // <hex> Tj  (CID/CMap fonts)
  const tjH = /<([0-9A-Fa-f]+)>\s*Tj/g;
  while ((m = tjH.exec(block)) !== null) out.push(hexToText(m[1]));

  // [<hex>...] TJ
  const tjHA = /\[([\s\S]*?)\]\s*TJ/g;
  while ((m = tjHA.exec(block)) !== null) {
    const hi = /<([0-9A-Fa-f]+)>/g;
    let h: RegExpExecArray | null;
    while ((h = hi.exec(m[1])) !== null) out.push(hexToText(h[1]));
  }
}

function hexToText(hex: string): string {
  if (hex.length % 4 === 0 && hex.length >= 4) {
    let s = "";
    for (let i = 0; i < hex.length; i += 4) {
      const cp = parseInt(hex.slice(i, i + 4), 16);
      if (cp > 31) s += String.fromCodePoint(cp);
    }
    if (s.trim()) return s;
  }
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
      const g = clean.slice(i, i + 5).padEnd(5, "u");
      let v = 0;
      for (const c of g) v = v * 85 + (c.charCodeAt(0) - 33);
      const n = Math.min(4, clean.length - i);
      for (let j = 0; j < n; j++) bytes.push((v >>> (24 - j * 8)) & 0xff);
      i += 5;
    }
    return latin1(new Uint8Array(bytes));
  } catch { return null; }
}

function decodeHex(s: string): string | null {
  try {
    const clean = s.replace(/\s/g, "").replace(/>$/, "");
    const bytes = new Uint8Array(Math.ceil(clean.length / 2));
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    return latin1(bytes);
  } catch { return null; }
}

function decodePdfString(s: string): string {
  return s
    .replace(/\\n/g, " ").replace(/\\r/g, " ").replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\")
    .replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
}
