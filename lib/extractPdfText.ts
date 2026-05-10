"use client";

export async function extractPdfText(file: File): Promise<{ text: string; pageCount: number }> {
  const buffer = await file.arrayBuffer();
  const bytes  = new Uint8Array(buffer);

  // latin1 gives us a bijective byte↔char mapping so we can recover exact bytes later
  const raw = new TextDecoder("latin1").decode(bytes);

  const pageCount = countPages(raw);
  const parts: string[] = [];

  // Strategy 1 — streams with explicit /Length (most reliable, avoids false endstream matches)
  await extractStreamsViaLength(raw, parts);

  // Strategy 2 — streams without reliable length (fallback regex, risky with binary data)
  if (parts.length === 0) {
    await extractStreamsFallback(raw, parts);
  }

  // Strategy 3 — direct BT/ET search in the raw document (uncompressed PDFs or metadata)
  extractBtEt(raw, parts);

  const text = dedupe(parts)
    .map(decodePdfString)
    .filter(s => s.trim().length > 1)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return { text, pageCount };
}

// ── Strategy 1: use explicit /Length to find exact stream boundaries ──────────
// This avoids the "false endstream" problem with binary compressed data.

async function extractStreamsViaLength(raw: string, out: string[]): Promise<void> {
  // Match dict << ... >> stream\n  allowing up to 2000 chars for the dict
  const re = /<<([\s\S]{1,2000}?)>>\s*stream\r?\n/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(raw)) !== null) {
    const dict      = m[1];
    const dataStart = m.index + m[0].length;

    // Only use direct integer length — skip indirect refs like "/Length 5 0 R"
    const lenMatch = dict.match(/\/Length\s+(\d+)(?!\s+\d+\s*R\b)/);
    if (!lenMatch) continue;

    const length = parseInt(lenMatch[1], 10);
    if (length <= 0 || dataStart + length > raw.length) continue;

    const content = raw.slice(dataStart, dataStart + length);
    await processStream(dict, content, out);
  }
}

// ── Strategy 2: regex-based stream extraction (fallback) ─────────────────────

async function extractStreamsFallback(raw: string, out: string[]): Promise<void> {
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(raw)) !== null) {
    const content   = m[1];
    const headerChunk = raw.slice(Math.max(0, m.index - 800), m.index);
    await processStream(headerChunk, content, out);
  }
}

// ── Shared stream processor ───────────────────────────────────────────────────

async function processStream(dictOrHeader: string, content: string, out: string[]): Promise<void> {
  const isFlate   = /\/Filter\s*(?:\/FlateDecode|\[[\s\S]{0,60}\/FlateDecode[\s\S]{0,60}\])/.test(dictOrHeader);
  const isAscii85 = /\/Filter\s*(?:\/ASCII85Decode|\[[\s\S]{0,60}\/ASCII85Decode[\s\S]{0,60}\])/.test(dictOrHeader);
  const isHex     = /\/Filter\s*(?:\/ASCIIHexDecode|\[[\s\S]{0,60}\/ASCIIHexDecode[\s\S]{0,60}\])/.test(dictOrHeader);

  if (isFlate) {
    // Try both zlib (with header) and raw deflate
    const decomp = await tryDecompress(content);
    if (decomp) extractBtEt(decomp, out);
  } else if (isAscii85) {
    const decoded = decodeAscii85(content);
    if (decoded) extractBtEt(decoded, out);
  } else if (isHex) {
    const decoded = decodeHex(content);
    if (decoded) extractBtEt(decoded, out);
  } else {
    extractBtEt(content, out);
  }
}

// ── Decompression ─────────────────────────────────────────────────────────────

async function tryDecompress(latin1Content: string): Promise<string | null> {
  const compressed = Uint8Array.from(
    { length: latin1Content.length },
    (_, i) => latin1Content.charCodeAt(i)
  );

  if (compressed.length < 2) return null;

  // Check for valid zlib magic bytes — avoids wasting cycles on non-compressed data
  const b0 = compressed[0];
  const b1 = compressed[1];
  const hasZlibHeader = b0 === 0x78 && (b1 === 0x01 || b1 === 0x5E || b1 === 0x9C || b1 === 0xDA);

  const formats: CompressionFormat[] = hasZlibHeader
    ? ["deflate", "deflate-raw"]   // try zlib first, raw as fallback
    : ["deflate-raw"];             // no zlib header, try raw deflate only

  for (const format of formats) {
    try {
      const ds     = new DecompressionStream(format);
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();

      // Await both write and close so their promise rejections are caught
      await writer.write(compressed);
      await writer.close();

      const chunks: Uint8Array[] = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value as Uint8Array);
      }

      const total  = chunks.reduce((s, c) => s + c.length, 0);
      const result = new Uint8Array(total);
      let   offset = 0;
      for (const c of chunks) { result.set(c, offset); offset += c.length; }

      return new TextDecoder("latin1").decode(result);
    } catch {
      // try next format silently
    }
  }
  return null;
}

// ── ASCII85 decoder (used by some PDF generators) ─────────────────────────────

function decodeAscii85(s: string): string | null {
  try {
    const clean = s.replace(/\s/g, "").replace(/~>$/, "");
    const bytes: number[] = [];
    let   i = 0;
    while (i < clean.length) {
      if (clean[i] === "z") { bytes.push(0, 0, 0, 0); i++; continue; }
      const group = clean.slice(i, i + 5).padEnd(5, "u");
      let   val   = 0;
      for (const c of group) val = val * 85 + (c.charCodeAt(0) - 33);
      const count = Math.min(4, clean.length - i);
      for (let j = 0; j < count; j++) bytes.push((val >>> (24 - j * 8)) & 0xff);
      i += 5;
    }
    return new TextDecoder("latin1").decode(new Uint8Array(bytes));
  } catch { return null; }
}

// ── Hex decoder ───────────────────────────────────────────────────────────────

function decodeHex(s: string): string | null {
  try {
    const clean = s.replace(/\s/g, "").replace(/>$/, "");
    const bytes = new Uint8Array(Math.ceil(clean.length / 2));
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    return new TextDecoder("latin1").decode(bytes);
  } catch { return null; }
}

// ── BT/ET text extraction ─────────────────────────────────────────────────────

function extractBtEt(text: string, out: string[]): void {
  // Standard BT...ET text blocks
  const btEt = /BT\b([\s\S]*?)\bET\b/g;
  let block: RegExpExecArray | null;
  while ((block = btEt.exec(text)) !== null) {
    extractStringsFromBlock(block[1], out);
  }
}

function extractStringsFromBlock(content: string, out: string[]): void {
  // (string) Tj
  const tj = /\(([^)]*(?:\\.[^)]*)*)\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = tj.exec(content)) !== null) out.push(m[1]);

  // [(str) gap (str) ...] TJ
  const tjArr = /\[([\s\S]*?)\]\s*TJ/g;
  while ((m = tjArr.exec(content)) !== null) {
    const inner = /\(([^)]*(?:\\.[^)]*)*)\)/g;
    let s: RegExpExecArray | null;
    while ((s = inner.exec(m[1])) !== null) out.push(s[1]);
  }

  // <hex string> Tj  (hex-encoded text)
  const tjHex = /<([0-9A-Fa-f]+)>\s*Tj/g;
  while ((m = tjHex.exec(content)) !== null) {
    const hex = m[1];
    let str = "";
    // Try UTF-16BE first (common for CID fonts), then single bytes
    if (hex.length % 4 === 0 && hex.length >= 4) {
      let utf16 = "";
      for (let i = 0; i < hex.length; i += 4) {
        const cp = parseInt(hex.slice(i, i + 4), 16);
        if (cp > 31) utf16 += String.fromCodePoint(cp);
      }
      if (utf16.trim().length > 0) { out.push(utf16); continue; }
    }
    // Single-byte hex
    for (let i = 0; i < hex.length; i += 2) {
      const byte = parseInt(hex.slice(i, i + 2), 16);
      if (byte > 31 && byte < 128) str += String.fromCharCode(byte);
    }
    if (str.trim()) out.push(str);
  }

  // <hex string> TJ arrays
  const tjHexArr = /\[([\s\S]*?)\]\s*TJ/g;
  while ((m = tjHexArr.exec(content)) !== null) {
    const hexInner = /<([0-9A-Fa-f]+)>/g;
    let h: RegExpExecArray | null;
    while ((h = hexInner.exec(m[1])) !== null) {
      let str = "";
      const hex = h[1];
      for (let i = 0; i < hex.length; i += 2) {
        const byte = parseInt(hex.slice(i, i + 2), 16);
        if (byte > 31 && byte < 128) str += String.fromCharCode(byte);
      }
      if (str.trim()) out.push(str);
    }
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function countPages(raw: string): number {
  const m = raw.match(/\/Count\s+(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

function decodePdfString(s: string): string {
  return s
    .replace(/\\n/g, " ").replace(/\\r/g, " ").replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\")
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}
