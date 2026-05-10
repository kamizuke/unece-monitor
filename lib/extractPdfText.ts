"use client";

/**
 * Extracts plain text from a PDF by parsing and decompressing its content streams.
 * Uses the browser's native DecompressionStream (zlib/FlateDecode).
 * Works with standard text-based PDFs. Image-only/scanned PDFs return empty text.
 */
export async function extractPdfText(file: File): Promise<{ text: string; pageCount: number }> {
  const buffer = await file.arrayBuffer();
  const bytes  = new Uint8Array(buffer);

  // latin1 is a bijective map byte↔char, so we can always recover bytes with charCodeAt
  const raw = new TextDecoder("latin1").decode(bytes);

  const pageCount = countPages(raw);
  const parts: string[] = [];

  await extractAllStreams(raw, parts);

  // Fallback: try direct BT/ET on raw (uncompressed PDFs or content outside streams)
  extractBtEt(raw, parts);

  const text = parts
    .map(decodePdfString)
    .filter(s => s.trim().length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return { text, pageCount };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function countPages(raw: string): number {
  const m = raw.match(/\/Count\s+(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}

async function extractAllStreams(raw: string, out: string[]): Promise<void> {
  // Locate every stream…endstream block and its preceding object header
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(raw)) !== null) {
    const streamContent = m[1];
    const startIdx      = m.index;

    // Look back up to 500 chars for the object header that declares filters
    const header = raw.slice(Math.max(0, startIdx - 500), startIdx);
    const isFlate = /\/Filter\s*(?:\/FlateDecode|\[.*\/FlateDecode.*\])/.test(header);

    if (isFlate) {
      const decompressed = await tryDecompress(streamContent);
      if (decompressed) extractBtEt(decompressed, out);
    } else {
      extractBtEt(streamContent, out);
    }
  }
}

async function tryDecompress(latin1Content: string): Promise<string | null> {
  try {
    // Recover original bytes from latin1 string
    const compressed = Uint8Array.from(
      { length: latin1Content.length },
      (_, i) => latin1Content.charCodeAt(i)
    );

    // Try zlib format first (standard FlateDecode), then raw deflate as fallback
    for (const format of ["deflate", "deflate-raw"] as const) {
      try {
        const ds     = new DecompressionStream(format);
        const writer = ds.writable.getWriter();
        const reader = ds.readable.getReader();

        writer.write(compressed);
        writer.close();

        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value as Uint8Array);
        }

        const total  = chunks.reduce((s, c) => s + c.length, 0);
        const result = new Uint8Array(total);
        let offset   = 0;
        for (const c of chunks) { result.set(c, offset); offset += c.length; }

        return new TextDecoder("latin1").decode(result);
      } catch {
        // try next format
      }
    }
    return null;
  } catch {
    return null;
  }
}

function extractBtEt(text: string, out: string[]): void {
  const btEt = /BT\b([\s\S]*?)\bET\b/g;
  let block: RegExpExecArray | null;

  while ((block = btEt.exec(text)) !== null) {
    const content = block[1];

    // (string) Tj
    const tj = /\(([^)]*(?:\\.[^)]*)*)\)\s*Tj/g;
    let m: RegExpExecArray | null;
    while ((m = tj.exec(content)) !== null) out.push(m[1]);

    // [(str) num ...] TJ
    const tjArr = /\[([\s\S]*?)\]\s*TJ/g;
    while ((m = tjArr.exec(content)) !== null) {
      const inner = /\(([^)]*(?:\\.[^)]*)*)\)/g;
      let s: RegExpExecArray | null;
      while ((s = inner.exec(m[1])) !== null) out.push(s[1]);
    }
  }
}

function decodePdfString(s: string): string {
  return s
    .replace(/\\n/g, " ").replace(/\\r/g, " ").replace(/\\t/g, " ")
    .replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\")
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}
