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
    const { autorun } = await req.json() as { autorun: boolean };
    if (typeof autorun !== "boolean") {
      return NextResponse.json({ error: "El campo 'autorun' debe ser booleano." }, { status: 400 });
    }

    // Get current file to obtain its SHA (required by GitHub API for updates)
    const getRes = await fetch(API, {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!getRes.ok) {
      const err = await getRes.json().catch(() => ({}));
      return NextResponse.json({ error: `GitHub API error: ${(err as { message?: string }).message ?? getRes.status}` }, { status: 502 });
    }

    const current = await getRes.json() as { sha: string; content: string };
    const existing = JSON.parse(Buffer.from(current.content, "base64").toString("utf-8"));
    const updated = { ...existing, autorun };
    const content = Buffer.from(JSON.stringify(updated, null, 2) + "\n").toString("base64");

    // Commit updated config.json
    const putRes = await fetch(API, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `chore: ${autorun ? "activar" : "desactivar"} ejecución automática`,
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
    console.error("[toggle-auto]", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}
