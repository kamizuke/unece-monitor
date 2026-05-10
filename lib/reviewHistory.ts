// ── Types ────────────────────────────────────────────────────────────────────

export interface ReviewedRegulation {
  regulationId: string;
  regulationTitle: string;
  url?: string;
  previousVersion?: string;
  currentVersion?: string;
  changeDetected: boolean;
  changeSummary?: string;
  impactLevel?: "green" | "yellow" | "orange" | "red";
  scopeAffected?: boolean;
  matchedScopeReferences?: string[];
  recommendedAction?: string;
}

export interface ReviewRecord {
  reviewId: string;
  reviewDate: string;       // ISO 8601
  reviewedBy: string;
  source: string;
  regulationsReviewed: ReviewedRegulation[];
  totalReviewed: number;
  totalWithChanges: number;
  totalWithoutChanges: number;
  generatedAt: string;      // ISO 8601
}

// ── IndexedDB ─────────────────────────────────────────────────────────────────

const DB_NAME    = "unece-monitor";
const DB_VERSION = 1;
const STORE      = "reviews";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "reviewId" });
        store.createIndex("reviewDate", "reviewDate");
      }
    };

    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror   = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

export async function saveReview(review: ReviewRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(review);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function loadAllReviews(): Promise<ReviewRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const all = (req.result as ReviewRecord[]).sort((a, b) =>
        b.reviewDate.localeCompare(a.reviewDate)
      );
      resolve(all);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteReview(reviewId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(reviewId);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function clearAllReviews(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function importReviews(records: ReviewRecord[]): Promise<void> {
  if (!records.length) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    records.forEach(r => store.put(r));
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

// ── Reviewer name (localStorage — small value, no IDB needed) ─────────────────

const REVIEWER_KEY = "unece_reviewer_name";

export function loadReviewerName(): string {
  try { return localStorage.getItem(REVIEWER_KEY) ?? ""; }
  catch { return ""; }
}

export function saveReviewerName(name: string): void {
  try { localStorage.setItem(REVIEWER_KEY, name.trim()); }
  catch {/* ignore */}
}

// ── CSV generation ─────────────────────────────────────────────────────────────

export const IMPACT_LABELS: Record<string, string> = {
  green:  "Informativo",
  yellow: "Revisar",
  orange: "Afecta método",
  red:    "Crítico",
};

function esc(val: unknown): string {
  const str = val == null ? "" : String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(...cols: unknown[]): string { return cols.map(esc).join(","); }

export function fmtDt(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day:"2-digit", month:"2-digit", year:"numeric",
    hour:"2-digit", minute:"2-digit",
  });
}

export function reviewToCsv(review: ReviewRecord): string {
  const lines: string[] = [];
  lines.push("EVIDENCIA DE VIGILANCIA NORMATIVA");
  lines.push(row("Fecha de revisión:", fmtDt(review.reviewDate)));
  lines.push(row("Fuente consultada:", review.source));
  lines.push(row("Revisado por:", review.reviewedBy));
  lines.push(row("ID de revisión:", review.reviewId));
  lines.push("");
  lines.push(row("Total de reglamentos revisados:", review.totalReviewed));
  lines.push(row("Reglamentos con cambios:", review.totalWithChanges));
  lines.push(row("Reglamentos sin cambios:", review.totalWithoutChanges));
  lines.push("");
  lines.push(row(
    "Reglamento", "Título", "URL", "Versión anterior", "Versión actual",
    "Resultado", "Resumen del cambio", "Nivel de impacto",
    "Afectación ISO 17025", "Referencias de alcance coincidentes", "Acción recomendada",
  ));
  for (const reg of review.regulationsReviewed) {
    lines.push(row(
      reg.regulationId, reg.regulationTitle, reg.url ?? "",
      reg.previousVersion ?? "", reg.currentVersion ?? "",
      reg.changeDetected ? "Con cambios" : "Sin cambios",
      reg.changeSummary ?? "",
      reg.impactLevel ? IMPACT_LABELS[reg.impactLevel] : "",
      reg.scopeAffected === true ? "Sí" : reg.scopeAffected === false ? "No" : "No evaluado",
      (reg.matchedScopeReferences ?? []).join("; "),
      reg.recommendedAction ?? "",
    ));
  }
  lines.push("");
  lines.push(row("Fecha de generación del informe:", fmtDt(review.generatedAt)));
  return "﻿" + lines.join("\n");
}

export function allReviewsToCsv(reviews: ReviewRecord[]): string {
  const lines: string[] = [];
  lines.push("HISTORIAL COMPLETO DE VIGILANCIA NORMATIVA");
  lines.push(row("Generado el:", fmtDt(new Date().toISOString())));
  lines.push(row("Total de revisiones:", reviews.length));
  lines.push("");
  lines.push(row(
    "ID Revisión", "Fecha de revisión", "Revisado por", "Fuente",
    "Reglamento", "Título", "URL", "Versión anterior", "Versión actual",
    "Resultado", "Resumen del cambio", "Nivel de impacto",
    "Afectación ISO 17025", "Referencias de alcance", "Acción recomendada",
  ));
  for (const review of reviews) {
    for (const reg of review.regulationsReviewed) {
      lines.push(row(
        review.reviewId, fmtDt(review.reviewDate), review.reviewedBy, review.source,
        reg.regulationId, reg.regulationTitle, reg.url ?? "",
        reg.previousVersion ?? "", reg.currentVersion ?? "",
        reg.changeDetected ? "Con cambios" : "Sin cambios",
        reg.changeSummary ?? "",
        reg.impactLevel ? IMPACT_LABELS[reg.impactLevel] : "",
        reg.scopeAffected === true ? "Sí" : reg.scopeAffected === false ? "No" : "No evaluado",
        (reg.matchedScopeReferences ?? []).join("; "),
        reg.recommendedAction ?? "",
      ));
    }
  }
  return "﻿" + lines.join("\n");
}

// ── JSON backup / restore ──────────────────────────────────────────────────────

export function exportHistoryJson(reviews: ReviewRecord[]): void {
  const content = JSON.stringify(reviews, null, 2);
  const blob    = new Blob([content], { type: "application/json;charset=utf-8;" });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement("a");
  a.href        = url;
  a.download    = `historial-vigilancia-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseHistoryJson(jsonText: string): ReviewRecord[] {
  const data = JSON.parse(jsonText);
  if (!Array.isArray(data)) throw new Error("El archivo no contiene un array de revisiones.");
  for (const r of data) {
    if (typeof r !== "object" || r === null || !("reviewId" in r) || !("reviewDate" in r)) {
      throw new Error("Formato inválido: registros sin campos requeridos (reviewId, reviewDate).");
    }
  }
  return data as ReviewRecord[];
}

// ── Download helpers ───────────────────────────────────────────────────────────

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function reviewFilename(review: ReviewRecord, ext = "csv"): string {
  const d = new Date(review.reviewDate);
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `evidencia-vigilancia-${stamp}.${ext}`;
}
