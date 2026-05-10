import { NextRequest, NextResponse } from "next/server";
import { githubToken, requireAdmin } from "@/lib/serverAuth";

export const runtime = "nodejs";

const OWNER = "kamizuke";
const REPO  = "unece-monitor";
const PATH  = "public/config.json";
const API   = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;

export async function POST(req: NextRequest) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const pat = githubToken();
  if (!pat) {
    return NextResponse.json({ error: "GH_PAT/GITHUB_PAT no configurado en el servidor." }, { status: 500 });
  }

  try {
    const body = await req.json() as { autorun?: boolean; regulations?: number[] };
    if (body.autorun !== undefined && typeof body.autorun !== "boolean") {
      return NextResponse.json({ error: "El campo 'autorun' debe ser booleano." }, { status: 400 });
    }
    if (body.regulations !== undefined) {
      if (!Array.isArray(body.regulations)) {
        return NextResponse.json({ error: "El campo 'regulations' debe ser un array." }, { status: 400 });
      }
      const invalid = body.regulations.find(n => !Number.isInteger(n) || n < 1 || n > 200);
      if (invalid !== undefined) {
        return NextResponse.json({ error: "Los reglamentos deben ser números enteros entre 1 y 200." }, { status: 400 });
      }
      body.regulations = [...new Set(body.regulations)].sort((a, b) => a - b);
    }

    // Fetch current file to get SHA and existing values
    const getRes = await fetch(API, {
      headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json" },
    });

    if (!getRes.ok) {
      const err = await getRes.json().catch(() => ({}));
      return NextResponse.json({ error: `GitHub API error: ${(err as { message?: string }).message ?? getRes.status}` }, { status: 502 });
    }

    const current = await getRes.json() as { sha: string; content: string };

    // Decode existing config and merge
    const existing = JSON.parse(Buffer.from(current.content, "base64").toString("utf-8"));
    const updated = {
      ...existing,
      ...(body.autorun !== undefined ? { autorun: body.autorun } : {}),
      ...(body.regulations !== undefined ? { regulations: body.regulations } : {}),
    };

    const content = Buffer.from(JSON.stringify(updated, null, 2) + "\n").toString("base64");
    const parts: string[] = [];
    if (body.regulations !== undefined) parts.push(`reglamentos: ${body.regulations.join(", ")}`);
    if (body.autorun !== undefined) parts.push(`autorun: ${body.autorun}`);

    const putRes = await fetch(API, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `chore: actualizar configuración (${parts.join("; ")})`,
        content,
        sha: current.sha,
        committer: { name: "UNECE Monitor", email: "bot@unece-monitor.noreply" },
      }),
    });

    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}));
      return NextResponse.json({ error: `GitHub API error: ${(err as { message?: string }).message ?? putRes.status}` }, { status: 502 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[save-config]", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}
