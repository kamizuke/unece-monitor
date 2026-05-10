import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ReviewRecord, ReviewedRegulation, IMPACT_LABELS, fmtDt } from "./reviewHistory";

// ── Palette matching the app's design tokens ───────────────────────────────
const C = {
  primary:   [0,  91, 157]  as [number, number, number],
  deep:      [0,  61, 107]  as [number, number, number],
  light:     [232, 241, 249] as [number, number, number],
  red:       [185,  28,  28] as [number, number, number],
  orange:    [194,  65,  12] as [number, number, number],
  yellow:    [146,  64,  14] as [number, number, number],
  green:     [21,  128,  61] as [number, number, number],
  muted:     [122, 134, 148] as [number, number, number],
  text:      [26,  35,  50]  as [number, number, number],
  white:     [255, 255, 255] as [number, number, number],
  rowAlt:    [240, 246, 252] as [number, number, number],
};

const IMPACT_COLORS: Record<string, [number, number, number]> = {
  red:    C.red,
  orange: C.orange,
  yellow: C.yellow,
  green:  C.green,
};

function impactColor(level?: string): [number, number, number] {
  return level ? IMPACT_COLORS[level] ?? C.muted : C.muted;
}

// ── Shared helpers ──────────────────────────────────────────────────────────

function pageFooter(doc: jsPDF, pageNum: number, totalPages: number, generatedAt: string) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...C.light);
  doc.setLineWidth(0.3);
  doc.line(14, H - 12, W - 14, H - 12);
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.setFont("helvetica", "normal");
  doc.text(`UNECE Regulatory Monitor · Generado: ${fmtDt(generatedAt)}`, 14, H - 7);
  doc.text(`Página ${pageNum} / ${totalPages}`, W - 14, H - 7, { align: "right" });
}

function drawHeader(doc: jsPDF, title: string, subtitle: string) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...C.deep);
  doc.rect(0, 0, W, 22, "F");
  doc.setTextColor(...C.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, 14, 14);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, W - 14, 14, { align: "right" });
}

function statBox(doc: jsPDF, x: number, y: number, label: string, value: number | string, color: [number, number, number]) {
  doc.setFillColor(...color);
  doc.roundedRect(x, y, 42, 16, 2, 2, "F");
  doc.setTextColor(...C.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(String(value), x + 21, y + 10, { align: "center" });
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text(label, x + 21, y + 15, { align: "center" });
}

// ── Single review PDF ───────────────────────────────────────────────────────

export function generateReviewPdf(review: ReviewRecord): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W   = doc.internal.pageSize.getWidth();

  drawHeader(
    doc,
    "EVIDENCIA DE VIGILANCIA NORMATIVA",
    "ISO/IEC 17025 · UNECE WP.29"
  );

  // Metadata block
  let y = 30;
  const meta: [string, string][] = [
    ["Fecha de revisión",    fmtDt(review.reviewDate)],
    ["Revisado por",         review.reviewedBy || "—"],
    ["Fuente consultada",    review.source],
    ["ID de revisión",       review.reviewId],
  ];
  doc.setFontSize(8.5);
  for (const [label, value] of meta) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.deep);
    doc.text(label + ":", 14, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.text);
    doc.text(value, 58, y);
    y += 5.5;
  }

  // Stats boxes
  y += 4;
  statBox(doc, 14,      y, "Revisados",    review.totalReviewed,     C.primary);
  statBox(doc, 14 + 46, y, "Con cambios",  review.totalWithChanges,  review.totalWithChanges > 0 ? C.orange : C.green);
  statBox(doc, 14 + 92, y, "Sin cambios",  review.totalWithoutChanges, C.green);
  y += 24;

  // Main table
  const hasScope = review.regulationsReviewed.some(r => r.scopeAffected !== undefined);

  const head = [[
    "Reglamento", "Título", "Resultado",
    "Nivel de impacto", "Resumen del cambio",
    ...(hasScope ? ["Afectación\nISO 17025"] : []),
    "Acción recomendada",
  ]];

  const body = review.regulationsReviewed.map(r => [
    r.regulationId,
    r.regulationTitle,
    r.changeDetected ? "Con cambios" : "Sin cambios",
    r.impactLevel ? IMPACT_LABELS[r.impactLevel] : "—",
    r.changeSummary ?? "—",
    ...(hasScope ? [r.scopeAffected === true ? "Sí" : r.scopeAffected === false ? "No" : "—"] : []),
    r.recommendedAction ?? "—",
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    headStyles: {
      fillColor: C.primary,
      textColor: C.white,
      fontSize: 7.5,
      fontStyle: "bold",
      cellPadding: 3,
    },
    bodyStyles:          { fontSize: 7, cellPadding: 2.5, textColor: C.text },
    alternateRowStyles:  { fillColor: C.rowAlt },
    columnStyles: {
      0: { cellWidth: 20,  fontStyle: "bold", textColor: C.deep },
      1: { cellWidth: 40 },
      2: { cellWidth: 22 },
      3: { cellWidth: 26 },
      4: { cellWidth: hasScope ? 55 : 70 },
      ...(hasScope ? { 5: { cellWidth: 18 }, 6: { cellWidth: "auto" as unknown as number } }
                   : { 5: { cellWidth: "auto" as unknown as number } }),
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      // Color-code the impact level and result cells
      if (data.section === "body") {
        if (data.column.index === 3) {
          const reg = review.regulationsReviewed[data.row.index] as ReviewedRegulation | undefined;
          if (reg?.impactLevel) {
            data.cell.styles.textColor = impactColor(reg.impactLevel);
            data.cell.styles.fontStyle = "bold";
          }
        }
        if (data.column.index === 2) {
          const reg = review.regulationsReviewed[data.row.index] as ReviewedRegulation | undefined;
          if (reg?.changeDetected) {
            data.cell.styles.textColor = C.orange;
            data.cell.styles.fontStyle = "bold";
          } else {
            data.cell.styles.textColor = C.green;
          }
        }
      }
    },
    didDrawPage: (data) => {
      pageFooter(doc, data.pageNumber, (doc as jsPDF & { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages(), review.generatedAt);
    },
  });

  doc.save(reviewFilename(review, "pdf"));
}

// ── Multi-review summary PDF ─────────────────────────────────────────────────

export function generateHistorySummaryPdf(reviews: ReviewRecord[]): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W   = doc.internal.pageSize.getWidth();

  drawHeader(
    doc,
    "HISTORIAL DE VIGILANCIA NORMATIVA",
    `${reviews.length} revisiones · ISO/IEC 17025 · UNECE WP.29`
  );

  let y = 30;
  doc.setFontSize(8.5);
  doc.setTextColor(...C.muted);
  doc.setFont("helvetica", "normal");
  doc.text(`Exportado el ${fmtDt(new Date().toISOString())}`, 14, y);
  y += 10;

  // Summary stats
  const totalReviewed = reviews.reduce((s, r) => s + r.totalReviewed, 0);
  const totalChanges  = reviews.reduce((s, r) => s + r.totalWithChanges, 0);
  statBox(doc, 14,      y, "Revisiones",   reviews.length, C.primary);
  statBox(doc, 14 + 46, y, "Regs revisadas", totalReviewed, C.deep);
  statBox(doc, 14 + 92, y, "Total cambios", totalChanges, totalChanges > 0 ? C.orange : C.green);
  y += 24;

  // One row per review (summary table)
  const head = [["Fecha", "Revisado por", "Regs revisadas", "Con cambios", "Sin cambios", "Impacto máximo", "Afectación alcance"]];
  const body = reviews.map(r => {
    const hasRed    = r.regulationsReviewed.some(reg => reg.impactLevel === "red");
    const hasOrange = r.regulationsReviewed.some(reg => reg.impactLevel === "orange");
    const hasYellow = r.regulationsReviewed.some(reg => reg.impactLevel === "yellow");
    const maxImpact = hasRed ? "Crítico" : hasOrange ? "Afecta método" : hasYellow ? "Revisar" : r.totalWithChanges > 0 ? "Informativo" : "—";
    const scopeAffected = r.regulationsReviewed.some(reg => reg.scopeAffected === true) ? "Sí" : "—";
    return [
      fmtDt(r.reviewDate),
      r.reviewedBy || "—",
      String(r.totalReviewed),
      String(r.totalWithChanges),
      String(r.totalWithoutChanges),
      maxImpact,
      scopeAffected,
    ];
  });

  autoTable(doc, {
    startY: y,
    head,
    body,
    headStyles: {
      fillColor: C.primary,
      textColor: C.white,
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles:         { fontSize: 8, textColor: C.text },
    alternateRowStyles: { fillColor: C.rowAlt },
    margin: { left: 14, right: 14 },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 36 },
      2: { cellWidth: 28 },
      3: { cellWidth: 24 },
      4: { cellWidth: 24 },
      5: { cellWidth: 32 },
      6: { cellWidth: 28 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 5) {
        const val = String(data.cell.text);
        if (val === "Crítico")       { data.cell.styles.textColor = C.red;    data.cell.styles.fontStyle = "bold"; }
        if (val === "Afecta método") { data.cell.styles.textColor = C.orange; data.cell.styles.fontStyle = "bold"; }
        if (val === "Revisar")       { data.cell.styles.textColor = C.yellow; }
      }
    },
    didDrawPage: (data) => {
      pageFooter(doc, data.pageNumber, (doc as jsPDF & { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages(), new Date().toISOString());
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`historial-vigilancia-${stamp}.pdf`);
}

// ── Re-export helper (avoids importing reviewHistory separately) ─────────────

function reviewFilename(review: ReviewRecord, ext: string): string {
  const d     = new Date(review.reviewDate);
  const stamp = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  return `evidencia-vigilancia-${stamp}.${ext}`;
}
