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
    const body = await req.json() as { autorun?: boolean; regulations?: number[] };

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
