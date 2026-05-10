import { NextRequest, NextResponse } from "next/server";
import {
  extractReferencesFromText,
  extractTestMethods,
  extractProductCategories,
  extractInternalCodes,
} from "../../../lib/matchScope";

export const runtime = "nodejs";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Content-Type must be multipart/form-data" }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("pdf") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "El archivo debe ser un PDF (application/pdf)." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "El archivo supera el límite de 10 MB." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Use internal path to avoid pdf-parse accessing test files on serverless (Vercel)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse/lib/pdf-parse");
    const parsed = await pdfParse(buffer);

    const rawText: string = parsed.text || "";
    const pageCount: number = parsed.numpages || 0;

    if (!rawText.trim()) {
      return NextResponse.json(
        { error: "No se pudo extraer texto del PDF. El archivo puede ser una imagen escaneada sin OCR." },
        { status: 422 }
      );
    }

    const extractedReferences = extractReferencesFromText(rawText);
    const testMethods         = extractTestMethods(rawText);
    const productCategories   = extractProductCategories(rawText);
    const internalCodes       = extractInternalCodes(rawText);

    return NextResponse.json({
      fileName:   file.name,
      pageCount,
      rawText,
      extractedReferences,
      testMethods,
      productCategories,
      internalCodes,
    });
  } catch (err) {
    console.error("[upload-scope] Error:", err);
    return NextResponse.json(
      { error: "Error al procesar el PDF. Verifica que el archivo no esté protegido." },
      { status: 500 }
    );
  }
}
