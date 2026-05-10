import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/serverAuth";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY no está configurada en las variables de entorno." },
      { status: 500 }
    );
  }

  let body: {
    regulation?: string;
    docType?: string;
    title?: string;
    summary?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido en el cuerpo de la petición." }, { status: 400 });
  }

  const { regulation, docType, title, summary } = body;
  if (!regulation || !title) {
    return NextResponse.json(
      { error: "Se requieren los campos 'regulation' y 'title'." },
      { status: 400 }
    );
  }

  const prompt = `Eres un experto en normativa técnica de vehículos UNECE/WP.29.
Analiza el siguiente cambio normativo y proporciona un informe estructurado en español.

**Reglamento:** ${regulation}
**Tipo de documento:** ${docType ?? "N/A"}
**Título:** ${title}
**Resumen preliminar:** ${summary ?? "No disponible"}

Proporciona un análisis con las siguientes secciones:

## Resumen ejecutivo
Una o dos frases sobre el impacto principal del cambio.

## Cambios técnicos clave
Lista los cambios técnicos más relevantes con su impacto práctico.

## Ámbito de aplicación
Qué tipos de vehículos, sistemas o componentes están afectados.

## Implicaciones para fabricantes
Qué deben hacer los fabricantes (OEM/Tier-1) para cumplir.

## Plazos y transición
Si se conocen, indica fechas de entrada en vigor o períodos de transición.

## Riesgo de incumplimiento
Nivel de riesgo (bajo/medio/alto) y consecuencias potenciales.

Sé conciso, técnico y orientado a la acción. Usa terminología estándar de homologación de vehículos.`;

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return NextResponse.json(
        { error: `Error de Anthropic API (${anthropicRes.status}): ${errText}` },
        { status: 502 }
      );
    }

    const data = await anthropicRes.json();
    const report = data.content?.[0]?.text ?? "El modelo no devolvió contenido.";
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json(
      { error: "Error de red al contactar con Anthropic API." },
      { status: 502 }
    );
  }
}
