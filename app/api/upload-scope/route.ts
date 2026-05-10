import { NextRequest, NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
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
    const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
    const { text: rawText } = await extractText(pdf, { mergePages: true });
    const pageCount = pdf.numPages;

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
      { error: `Error al procesar el PDF: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
