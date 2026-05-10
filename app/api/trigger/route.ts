import { NextResponse } from "next/server";
import { githubToken } from "@/lib/serverAuth";

export const runtime = "edge";

export async function POST() {
  const token = githubToken();
  if (!token) {
    return NextResponse.json(
      { error: "GITHUB_PAT no está configurada en las variables de entorno." },
      { status: 500 }
    );
  }

  const res = await fetch(
    "https://api.github.com/repos/kamizuke/unece-monitor/actions/workflows/monitor.yml/dispatches",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    }
  );

  if (res.status === 204) {
    return NextResponse.json({ ok: true });
  }

  const text = await res.text();
  return NextResponse.json(
    { error: `GitHub API error ${res.status}: ${text}` },
    { status: 502 }
  );
}
