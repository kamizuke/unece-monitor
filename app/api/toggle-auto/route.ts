import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const OWNER = "kamizuke";
const REPO  = "unece-monitor";
const PATH  = "public/config.json";
const API   = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;

export async function POST(req: NextRequest) {
  const pat = process.env.GH_PAT;
  if (!pat) {
    return NextResponse.json({ error: "GH_PAT no configurado en el servidor." }, { status: 500 });
  }

  try {
    const { autorun } = await req.json() as { autorun: boolean };

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

    const current = await getRes.json() as { sha: string };
    const content = Buffer.from(JSON.stringify({ autorun }, null, 2) + "\n").toString("base64");

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

    return NextResponse.json({ autorun });
  } catch (err) {
    console.error("[toggle-auto]", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}
