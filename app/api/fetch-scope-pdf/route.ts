import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_HOSTS = ["enac.es", "www.enac.es"];

export async function POST(req: NextRequest) {
  let url: string;
  try {
    ({ url } = await req.json() as { url: string });
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL requerida." }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "URL no válida." }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json({ error: "Solo se permiten URLs de enac.es." }, { status: 403 });
  }

  let pdfRes: Response;
  try {
    pdfRes = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; UNECEMonitor/1.0)",
        "Accept": "application/pdf,*/*",
      },
      redirect: "follow",
    });
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con enac.es." }, { status: 502 });
  }

  if (!pdfRes.ok) {
    return NextResponse.json({ error: `ENAC respondió ${pdfRes.status}.` }, { status: 502 });
  }

  const ct = pdfRes.headers.get("content-type") ?? "";
  if (!ct.includes("pdf") && !ct.includes("octet-stream")) {
    return NextResponse.json({ error: "La URL no apunta a un PDF." }, { status: 422 });
  }

  // Stream the PDF body directly — avoids buffering the whole file in memory
  return new Response(pdfRes.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="enac-alcance.pdf"',
    },
  });
}
