import { NextRequest, NextResponse } from "next/server";

export function requireAdmin(req: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return null;

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const provided = req.headers.get("x-admin-token") ?? bearer;

  if (provided === expected) return null;

  return NextResponse.json(
    { error: "No autorizado. Introduce la clave de administrador.", authRequired: true },
    { status: 401 }
  );
}

export function githubToken(): string | undefined {
  return process.env.GH_PAT || process.env.GITHUB_PAT;
}
