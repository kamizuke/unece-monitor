import { NextRequest, NextResponse } from "next/server";

// This route is kept for potential future use but PDF extraction
// now happens client-side via lib/extractPdfText.ts
export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: "La extracción de PDF se realiza ahora en el navegador. Esta ruta ya no se usa." },
    { status: 410 }
  );
}
