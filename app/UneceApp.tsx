"use client";

import { useState, useEffect, useRef } from "react";
import { classifyRegulatoryChange, ImpactClassification } from "@/lib/classifyChange";
import {
  matchChangeAgainstScope,
  AccreditationScope,
  ScopeMatch,
  extractReferencesFromText,
  extractTestMethods,
  extractProductCategories,
  extractInternalCodes,
  extractRegNums,
} from "@/lib/matchScope";
import {
  ReviewRecord,
  ReviewedRegulation,
  saveReview,
  loadAllReviews,
  deleteReview,
  downloadCsv,
  reviewToCsv,
  allReviewsToCsv,
  reviewFilename,
  exportHistoryJson,
  parseHistoryJson,
  importReviews,
  loadReviewerName,
  saveReviewerName,
} from "@/lib/reviewHistory";

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────────
const T = {
  blue:      "#005b9d",
  blueDeep:  "#003d6b",
  blueMid:   "#0070bf",
  blueLight: "#e8f1f9",
  blueFaint: "#f0f6fc",
  grey:      "#b1aba3",
  greyLight: "#f5f4f3",
  greyMid:   "#8a847d",
  bg:        "#f7f8fa",
  surface:   "#ffffff",
  border:    "#e2e6ea",
  border2:   "#cdd2d8",
  text:      "#1a2332",
  body:      "#3d4a5c",
  muted:     "#7a8694",
  dim:       "#b0bac4",
  rev:       "#005b9d",
  am:        "#7c3aed",
  sup:       "#0891b2",
  cor:       "#c2410c",
  ok:        "#15803d",
  okBg:      "#f0fdf4",
  warn:      "#b45309",
  warnBg:    "#fffbeb",
  mono:      "'JetBrains Mono', monospace",
  sans:      "'Outfit', sans-serif",
};

const ALL_REGS = [
  { n: 1,   title: "Headlights — sealed beam",           cat: "Iluminación" },
  { n: 3,   title: "Retro-reflective devices",           cat: "Iluminación" },
  { n: 4,   title: "Rear position lamps",                cat: "Iluminación" },
  { n: 6,   title: "Direction indicators",               cat: "Iluminación" },
  { n: 7,   title: "Front/rear position lamps",          cat: "Iluminación" },
  { n: 10,  title: "Electromagnetic compatibility",      cat: "Electrónica" },
  { n: 13,  title: "Braking — heavy vehicles",           cat: "Frenado" },
  { n: 14,  title: "Seat belt anchorages",               cat: "Seguridad Pasiva" },
  { n: 16,  title: "Safety belts and restraint systems", cat: "Seguridad Pasiva" },
  { n: 17,  title: "Seats, headrests and anchorages",    cat: "Seguridad Pasiva" },
  { n: 18,  title: "Anti-theft protection",              cat: "Seguridad" },
  { n: 19,  title: "Front fog lamps",                    cat: "Iluminación" },
  { n: 20,  title: "Headlamps — halogen H4",             cat: "Iluminación" },
  { n: 21,  title: "Interior fittings",                  cat: "Seguridad Pasiva" },
  { n: 22,  title: "Protective helmets",                 cat: "EPI" },
  { n: 25,  title: "Head restraints",                    cat: "Seguridad Pasiva" },
  { n: 26,  title: "External projections",               cat: "Seguridad Pasiva" },
  { n: 28,  title: "Audible warning devices",            cat: "General" },
  { n: 34,  title: "Prevention of fire risk",            cat: "General" },
  { n: 39,  title: "Speedometers",                       cat: "Electrónica" },
  { n: 44,  title: "Child restraint systems",            cat: "Seguridad Pasiva" },
  { n: 48,  title: "Installation of lighting",           cat: "Iluminación" },
  { n: 49,  title: "Emissions — diesel engines",         cat: "Emisiones" },
  { n: 51,  title: "Noise emissions",                    cat: "Ruido" },
  { n: 58,  title: "Rear underrun protection",           cat: "General" },
  { n: 66,  title: "Bus rollover strength",              cat: "Seguridad Pasiva" },
  { n: 73,  title: "Lateral protection devices",         cat: "General" },
  { n: 79,  title: "Steering equipment",                 cat: "General" },
  { n: 80,  title: "Seats of large passenger vehicles",  cat: "Seguridad Pasiva" },
  { n: 83,  title: "Emissions — light vehicles",         cat: "Emisiones" },
  { n: 89,  title: "Speed limiting devices",             cat: "Electrónica" },
  { n: 90,  title: "Replacement brake linings",          cat: "Frenado" },
  { n: 94,  title: "Frontal collision protection",       cat: "Seguridad Pasiva" },
  { n: 95,  title: "Lateral collision protection",       cat: "Seguridad Pasiva" },
  { n: 100, title: "Battery electric vehicles",          cat: "EV/Híbrido" },
  { n: 116, title: "Anti-theft — motorcycles",           cat: "Seguridad" },
  { n: 121, title: "Hand controls & indicators",         cat: "Electrónica" },
  { n: 129, title: "Child restraints i-Size",            cat: "Seguridad Pasiva" },
  { n: 137, title: "Frontal impact — airbag",            cat: "Seguridad Pasiva" },
  { n: 151, title: "Blind spot monitoring",              cat: "ADAS" },
  { n: 152, title: "AEBS — pedestrians/cyclists",        cat: "ADAS" },
  { n: 155, title: "Cybersecurity management",           cat: "Electrónica" },
  { n: 156, title: "Software update management",        cat: "Electrónica" },
  { n: 157, title: "Automated Lane Keeping (ALKS)",      cat: "ADAS" },
  { n: 158, title: "REESS safety requirements",          cat: "EV/Híbrido" },
  { n: 159, title: "Interior monitoring systems",        cat: "ADAS" },
  { n: 160, title: "Event data recorder",                cat: "Electrónica" },
];

const CATS = ["Todos", "Iluminación", "Frenado", "Seguridad Pasiva", "ADAS", "Emisiones", "Electrónica", "EV/Híbrido", "Seguridad", "Ruido", "General", "EPI"];

const DOC_CFG: Record<string, { color: string; bg: string; label: string; short: string; icon: string; desc: string }> = {
  REVISION:    { color: T.rev,  bg: T.blueFaint, label: "Revisión",    short: "REV", icon: "📘", desc: "Reescritura completa del reglamento. Reemplaza la versión anterior en su totalidad e implica cambios estructurales importantes. Requiere evaluación completa del impacto en los procedimientos del laboratorio." },
  AMENDMENT:   { color: T.am,   bg: "#faf5ff",   label: "Amendment",   short: "AM",  icon: "📝", desc: "Modificación puntual de artículos específicos de un reglamento en vigor. Puede añadir, modificar o suprimir requisitos técnicos concretos. Es el tipo de cambio más frecuente." },
  SUPPLEMENT:  { color: T.sup,  bg: "#f0f9ff",   label: "Supplement",  short: "SUP", icon: "➕", desc: "Adición de nuevas series de enmiendas o de requisitos opcionales/alternativos al reglamento. No modifica los requisitos existentes, sino que los amplía." },
  CORRIGENDUM: { color: T.cor,  bg: "#fff7ed",   label: "Corrigendum", short: "COR", icon: "🔧", desc: "Corrección de errores tipográficos, de traducción o editoriales en un texto ya publicado. Generalmente no implica cambios técnicos sustanciales en los ensayos." },
};

const MOCK_CHANGES: Change[] = [];
const SCOPE_STORAGE_KEY    = "unece_accreditation_scope";
const DEMO_DISMISSED_KEY   = "unece_demo_dismissed";
const BASELINE_KEY         = "unece_baseline_set";

const DEMO_CHANGE: Change = {
  id: "c1",
  reg: 17,
  doc_type: "AMENDMENT",
  change_type: "amendment",
  title: "Supplement 14 to the 09 series of amendments — Seats, head restraints and anchorages",
  url: "https://unece.org/transport/documents/2024/06/working-documents/ecewp2941-add16supp13",
  timestamp: new Date().toISOString(),
  has_pdf: true,
  has_prev: true,
  summary: "Este es un ejemplo de cómo aparece un cambio detectado. El monitor rastrea el portal UNECE/CEPE de forma automática y notifica aquí cuando se publican enmiendas, suplementos, revisiones o corrigendos en los reglamentos seleccionados. Pulse «Eliminar ejemplo» para no volver a verlo.",
};

interface Change {
  id: string;
  reg: number;
  doc_type: string;
  change_type: string;
  title: string;
  url?: string;
  timestamp: string;
  has_pdf: boolean;
  has_prev: boolean;
  summary: string;
}

function regId(n: number) { return `R${String(n).padStart(3, "0")}`; }
function fmtDate(ts: string) { return new Date(ts).toLocaleDateString("es-ES", { day:"2-digit", month:"short", year:"numeric", timeZone:"Europe/Madrid" }); }

// ── SHARED COMPONENTS ─────────────────────────────────────────────────────────

function TypeBadge({ type, size = "sm" }: { type: string; size?: "sm" | "md" }) {
  const cfg = DOC_CFG[type] || { color: T.muted, bg: T.bg, short: "DOC", label: "Documento" };
  const p = size === "sm" ? "2px 6px" : "3px 10px";
  const fs = size === "sm" ? 9 : 11;
  return (
    <span style={{ fontFamily:T.mono, fontSize:fs, fontWeight:700, letterSpacing:"0.1em",
      color:cfg.color, background:cfg.bg, border:`1px solid ${cfg.color}30`,
      borderRadius:3, padding:p, whiteSpace:"nowrap" as const }}>
      {cfg.short}
    </span>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5,
      background: ok ? T.okBg : T.warnBg,
      border:`1px solid ${ok ? "#bbf7d0" : "#fde68a"}`,
      color: ok ? T.ok : T.warn,
      borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:600, fontFamily:T.sans }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background: ok ? T.ok : T.warn,
        boxShadow: ok ? "none" : `0 0 5px ${T.warn}` }} />
      {label}
    </span>
  );
}

function MarkdownReport({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div style={{ fontSize:13.5, lineHeight:1.8, color:T.body }}>
      {lines.map((line, i) => {
        if (line.startsWith("## ")) return (
          <h3 key={i} style={{ fontFamily:T.sans, fontSize:13, fontWeight:700, color:T.blueDeep,
            textTransform:"uppercase" as const, letterSpacing:"0.06em",
            borderLeft:`3px solid ${T.blue}`, paddingLeft:10,
            marginTop:24, marginBottom:10 }}>
            {line.replace("## ", "")}
          </h3>
        );
        if (line.startsWith("**") && line.includes("**")) {
          const parts = line.split(/\*\*(.*?)\*\*/g);
          return <p key={i} style={{ margin:"4px 0" }}>{parts.map((p, j) => j % 2 === 1
            ? <strong key={j} style={{ color:T.text, fontWeight:600 }}>{p}</strong> : p)}</p>;
        }
        if (line.startsWith("| ") && line.includes("|")) {
          const cells = line.split("|").filter(c => c.trim());
          const next = lines[i + 1] || "";
          const isHeader = next.includes("---");
          if (line.includes("---")) return null;
          return (
            <div key={i} style={{ display:"grid", gridTemplateColumns:`repeat(${cells.length},1fr)`, gap:1, marginBottom:1 }}>
              {cells.map((c, j) => (
                <div key={j} style={{ padding:"6px 12px", background: isHeader ? T.blueLight : T.surface,
                  border:`1px solid ${T.border}`, fontSize:12,
                  fontWeight:isHeader ? 700 : 400, color:isHeader ? T.blueDeep : T.body }}>
                  {c.trim()}
                </div>
              ))}
            </div>
          );
        }
        if (line.match(/^\d+\./)) return (
          <div key={i} style={{ display:"flex", gap:10, margin:"4px 0", paddingLeft:4 }}>
            <span style={{ color:T.blue, fontFamily:T.mono, fontSize:12, fontWeight:700, flexShrink:0, minWidth:18 }}>{(line.match(/^\d+/) || [""])[0]}.</span>
            <span>{line.replace(/^\d+\.\s*/, "")}</span>
          </div>
        );
        if (line.startsWith("- ")) return (
          <div key={i} style={{ display:"flex", gap:10, margin:"3px 0", paddingLeft:4 }}>
            <span style={{ color:T.blue, flexShrink:0 }}>–</span>
            <span style={{ color:T.body }}>{line.slice(2)}</span>
          </div>
        );
        if (line.trim() === "") return <div key={i} style={{ height:8 }} />;
        return <p key={i} style={{ margin:"3px 0" }}>{line}</p>;
      })}
    </div>
  );
}

// ── IMPACT BADGE ──────────────────────────────────────────────────────────────

const IMPACT_COLORS = {
  green:  { bg:"#f0fdf4", border:"#86efac", color:"#15803d", dot:"#22c55e", label:"INFORMATIVO" },
  yellow: { bg:"#fffbeb", border:"#fde68a", color:"#92400e", dot:"#f59e0b", label:"REVISAR" },
  orange: { bg:"#fff7ed", border:"#fdba74", color:"#c2410c", dot:"#f97316", label:"AFECTA MÉTODO" },
  red:    { bg:"#fef2f2", border:"#fca5a5", color:"#b91c1c", dot:"#ef4444", label:"CRÍTICO" },
};

function ImpactBadge({ clf }: { clf: ImpactClassification }) {
  const c = IMPACT_COLORS[clf.impactLevel];
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"8px 12px",
      background:c.bg, border:`1px solid ${c.border}`, borderRadius:6, marginTop:8 }}>
      <span style={{ width:8, height:8, borderRadius:"50%", background:c.dot,
        flexShrink:0, marginTop:3, boxShadow:`0 0 4px ${c.dot}60` }} />
      <div style={{ flex:1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" as const }}>
          <span style={{ fontSize:10.5, fontWeight:700, color:c.color, letterSpacing:"0.06em" }}>
            {c.label}
          </span>
          <span style={{ fontSize:10, color:c.color, opacity:0.65 }}>
            {Math.round(clf.confidence * 100)}% conf.
          </span>
          {clf.affectedTopics.length > 0 && (
            <span style={{ fontSize:9.5, color:c.color, opacity:0.55 }}>
              · {clf.affectedTopics.slice(0, 3).join(", ")}
            </span>
          )}
        </div>
        {clf.reasons.slice(0, 2).map((r, i) => (
          <div key={i} style={{ fontSize:10.5, color:c.color, opacity:0.75, marginTop:2 }}>{r}</div>
        ))}
        <div style={{ fontSize:10, color:c.color, opacity:0.6, marginTop:3, fontStyle:"italic" }}>
          {clf.recommendedAction}
        </div>
      </div>
    </div>
  );
}

// ── SCOPE MATCH ROW ───────────────────────────────────────────────────────────

function ScopeMatchRow({ match }: { match: ScopeMatch }) {
  const [expanded, setExpanded] = useState(false);

  if (!match.isAffected && match.matchScore === 0) {
    return (
      <div style={{ fontSize:10.5, color:T.dim, marginTop:6, display:"flex", alignItems:"center", gap:5 }}>
        <span style={{ fontSize:11 }}>◎</span>
        <span>Sin afectación detectada en alcance acreditado</span>
      </div>
    );
  }

  const scoreColor = match.matchScore >= 60 ? "#b91c1c"
    : match.matchScore >= 30 ? "#c2410c"
    : "#92400e";

  return (
    <div style={{ marginTop:6, padding:"8px 10px", background:"#f8fafc",
      border:`1px solid ${match.isAffected ? "#fca5a5" : "#e2e8f0"}`,
      borderRadius:5, fontSize:10.5 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}
           onClick={() => setExpanded(e => !e)}>
        <span style={{ fontSize:12 }}>⚑</span>
        <span style={{ color:scoreColor, fontWeight:700 }}>
          {match.isAffected ? "Afectación probable al alcance" : "Posible relación con el alcance"}
        </span>
        <span style={{ fontFamily:T.mono, fontSize:9, background:scoreColor, color:"white",
          borderRadius:3, padding:"1px 6px" }}>
          {match.matchScore}%
        </span>
        <span style={{ marginLeft:"auto", color:T.muted, fontSize:10 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:4 }}>
          <div style={{ fontSize:10.5, color:T.body }}>{match.explanation}</div>
          {match.matchedReferences.length > 0 && (
            <div>
              <div style={{ fontSize:10, fontWeight:600, color:T.muted, marginTop:4 }}>Referencias coincidentes:</div>
              {match.matchedReferences.map((r, i) => (
                <div key={i} style={{ fontSize:10, color:T.body, marginTop:1 }}>↳ {r}</div>
              ))}
            </div>
          )}
          {match.affectedMethods.length > 0 && (
            <div>
              <div style={{ fontSize:10, fontWeight:600, color:T.muted, marginTop:4 }}>Métodos posiblemente afectados:</div>
              {match.affectedMethods.map((m, i) => (
                <div key={i} style={{ fontSize:10, color:T.body, marginTop:1 }}>↳ {m}</div>
              ))}
            </div>
          )}
          {match.affectedCategories.length > 0 && (
            <div style={{ fontSize:10, color:T.body, marginTop:4 }}>
              Áreas: {match.affectedCategories.join(", ")}
            </div>
          )}
          <div style={{ fontSize:10, color:T.muted, marginTop:4, fontStyle:"italic" }}>
            {match.recommendedAction}
          </div>
        </div>
      )}
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function UneceApp() {
  const [monitored, setMonitored]           = useState(new Set<number>());
  const [showDemo, setShowDemo]             = useState(false);
  const [baselineSet, setBaselineSet]       = useState(false);
  const [showBaselineBanner, setShowBaselineBanner] = useState(false);
  const [view, setView]                     = useState("dashboard");
  const [search, setSearch]                 = useState("");
  const [catFilter, setCatFilter]           = useState("Todos");
  const [selectedChange, setSelectedChange] = useState<Change | null>(null);
  const [aiLoading, setAiLoading]           = useState(false);
  const [aiReport, setAiReport]             = useState("");
  const [allChanges, setAllChanges]         = useState<Change[]>(MOCK_CHANGES);
  const [loadingData, setLoadingData]       = useState(true);
  const [lastCheck, setLastCheck]           = useState<string | null>(null);
  const [triggering, setTriggering]         = useState(false);
  const [triggerMsg, setTriggerMsg]         = useState<string | null>(null);

  // ── Review history state ──────────────────────────────────────────────────
  const [reviews, setReviews]               = useState<ReviewRecord[]>([]);
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo]   = useState("");
  const [generatingReview, setGeneratingReview] = useState(false);
  const [reviewMsg, setReviewMsg]           = useState<string | null>(null);
  const [reviewerName, setReviewerName]     = useState("");
  const [importingJson, setImportingJson]   = useState(false);
  const jsonImportRef                       = useRef<HTMLInputElement>(null);

  // ── Autorun toggle state ──────────────────────────────────────────────────
  const [autorun, setAutorun]           = useState<boolean | null>(null); // null = loading
  const [autorunSaving, setAutorunSaving] = useState(false);

  // ── Accreditation scope state ─────────────────────────────────────────────
  const [scope, setScope]               = useState<AccreditationScope | null>(null);
  const [scopeUploading, setScopeUploading] = useState(false);
  const [scopeError, setScopeError]     = useState<string | null>(null);
  const [scopeSuccess, setScopeSuccess] = useState<string | null>(null);
  const [expandedDocType, setExpandedDocType] = useState<string | null>(null);
  const fileInputRef                    = useRef<HTMLInputElement>(null);

  // ── Load data on mount ────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/changes_log.json?_=" + Date.now())
      .then(r => r.json())
      .then((data: Change[]) => {
        if (Array.isArray(data) && data.length > 0) setAllChanges(data);
      })
      .catch(() => {/* keep mock data */})
      .finally(() => setLoadingData(false));

    fetch("/state.json?_=" + Date.now())
      .then(r => r.json())
      .then((s: { last_check?: string }) => { if (s.last_check) setLastCheck(s.last_check); })
      .catch(() => {});

    // Load autorun flag from config.json
    fetch("/config.json?_=" + Date.now())
      .then(r => r.json())
      .then((cfg: { autorun?: boolean }) => setAutorun(cfg.autorun !== false))
      .catch(() => setAutorun(true));

    // Show demo card unless user already dismissed it
    setShowDemo(!localStorage.getItem(DEMO_DISMISSED_KEY));

    // Baseline tracking
    const bl = !!localStorage.getItem(BASELINE_KEY);
    setBaselineSet(bl);

    // Load persisted scope from localStorage
    try {
      const stored = localStorage.getItem(SCOPE_STORAGE_KEY);
      if (stored) setScope(JSON.parse(stored));
    } catch {/* ignore */}

    // Load review history from IndexedDB
    loadAllReviews().then(setReviews).catch(() => setReviews([]));

    // Load reviewer name from localStorage
    setReviewerName(loadReviewerName());
  }, []);

  // ── Autorun toggle ────────────────────────────────────────────────────────
  async function toggleAutorun() {
    if (autorunSaving || autorun === null) return;
    const next = !autorun;
    setAutorunSaving(true);
    try {
      const res = await fetch("/api/toggle-auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autorun: next }),
      });
      if (res.ok) setAutorun(next);
    } finally {
      setAutorunSaving(false);
    }
  }

  // ── PDF Upload (client-side extraction — no server, no size limit) ──────────
  async function handlePdfUpload(file: File) {
    if (file.type !== "application/pdf") {
      setScopeError("El archivo debe ser un PDF.");
      return;
    }

    setScopeUploading(true);
    setScopeError(null);
    setScopeSuccess(null);

    try {
      const { extractPdfText } = await import("@/lib/extractPdfText");
      const { text: rawText, pageCount } = await extractPdfText(file);

      if (!rawText.trim()) {
        setScopeError("No se pudo extraer texto del PDF. El archivo puede ser una imagen escaneada sin OCR.");
        return;
      }

      const extractedReferences = extractReferencesFromText(rawText);
      const testMethods         = extractTestMethods(rawText);
      const productCategories   = extractProductCategories(rawText);
      const internalCodes       = extractInternalCodes(rawText);

      const newScope: AccreditationScope = {
        id:          crypto.randomUUID(),
        fileName:    file.name,
        uploadedAt:  new Date().toISOString(),
        pageCount,
        rawText:     rawText.slice(0, 100_000),
        extractedReferences,
        testMethods,
        productCategories,
        internalCodes,
      };

      setScope(newScope);
      localStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify(newScope));
      setScopeSuccess(
        `Alcance procesado: ${extractedReferences.length} referencias, ` +
        `${testMethods.length} métodos detectados.`
      );
    } catch (err) {
      setScopeError(`Error al procesar el PDF: ${err instanceof Error ? err.message : "inténtalo de nuevo."}`);
    } finally {
      setScopeUploading(false);
    }
  }

  // ── Generate review record ────────────────────────────────────────────────
  async function generateReview() {
    setGeneratingReview(true);
    setReviewMsg(null);
    try {
      const now = new Date().toISOString();

      const regulationsReviewed: ReviewedRegulation[] = [...monitored].sort((a, b) => a - b).map(n => {
        const reg    = ALL_REGS.find(r => r.n === n);
        const change = allChanges.find(c => c.reg === n);

        let impactLevel: ReviewedRegulation["impactLevel"];
        let scopeAffected: boolean | undefined;
        let matchedScopeReferences: string[] | undefined;
        let recommendedAction: string | undefined;

        if (change) {
          const clf = classifyRegulatoryChange(change.summary, { reg: n, doc_type: change.doc_type });
          impactLevel       = clf.impactLevel;
          recommendedAction = clf.recommendedAction;

          if (scope) {
            const m = matchChangeAgainstScope(
              { reg: n, title: change.title, summary: change.summary, doc_type: change.doc_type },
              scope
            );
            scopeAffected           = m.isAffected;
            matchedScopeReferences  = m.matchedReferences;
            if (!recommendedAction) recommendedAction = m.recommendedAction;
          }
        }

        return {
          regulationId:          regId(n),
          regulationTitle:       reg?.title ?? `Regulation ${n}`,
          url:                   change?.url ?? "https://unece.org/transport/vehicle-regulations",
          changeDetected:        !!change,
          changeSummary:         change?.summary,
          impactLevel,
          scopeAffected,
          matchedScopeReferences,
          recommendedAction,
        };
      });

      const record: ReviewRecord = {
        reviewId:             crypto.randomUUID(),
        reviewDate:           now,
        reviewedBy:           (reviewerName || loadReviewerName()).trim() || "Sistema",
        source:               "https://unece.org/transport/vehicle-regulations",
        regulationsReviewed,
        totalReviewed:        regulationsReviewed.length,
        totalWithChanges:     regulationsReviewed.filter(r => r.changeDetected).length,
        totalWithoutChanges:  regulationsReviewed.filter(r => !r.changeDetected).length,
        generatedAt:          now,
      };

      await saveReview(record);
      const updated = await loadAllReviews();
      setReviews(updated);
      setView("history");
      setReviewMsg(`✓ Revisión registrada — ${record.totalReviewed} reglamentos, ${record.totalWithChanges} con cambios`);
      setTimeout(() => setReviewMsg(null), 6000);
    } catch (e) {
      setReviewMsg(`✗ Error al generar la revisión: ${e instanceof Error ? e.message : "error desconocido"}`);
    } finally {
      setGeneratingReview(false);
    }
  }

  function clearScope() {
    setScope(null);
    localStorage.removeItem(SCOPE_STORAGE_KEY);
    setScopeSuccess(null);
    setScopeError(null);
  }

  // ── Scraper trigger ───────────────────────────────────────────────────────
  async function triggerScraper() {
    const isFirstRun = !lastCheck && !baselineSet;
    setTriggering(true);
    setTriggerMsg(null);
    try {
      const res = await fetch("/api/trigger", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error desconocido");
      setLastCheck(new Date().toISOString());
      if (isFirstRun) {
        localStorage.setItem(BASELINE_KEY, new Date().toISOString());
        setBaselineSet(true);
        setShowBaselineBanner(true);
      }
      setTriggerMsg("✓ Scraping iniciado — los resultados aparecerán en ~2 min");
      // Re-fetch state after scraper likely finishes
      setTimeout(() => {
        fetch("/state.json?_=" + Date.now())
          .then(r => r.json())
          .then((s: { last_check?: string }) => { if (s.last_check) setLastCheck(s.last_check); })
          .catch(() => {});
      }, 150_000); // 2.5 min
    } catch (e: unknown) {
      setTriggerMsg(`✗ ${e instanceof Error ? e.message : "Error al lanzar el scraper"}`);
    } finally {
      setTriggering(false);
      setTimeout(() => setTriggerMsg(null), 6000);
    }
  }

  const toggleReg = (n: number) => setMonitored(prev => {
    const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s;
  });

  const monChanges = allChanges.filter(c => monitored.has(c.reg));

  const dismissDemo = () => {
    localStorage.setItem(DEMO_DISMISSED_KEY, "1");
    setShowDemo(false);
  };

  const requestAnalysis = async (change: Change) => {
    setSelectedChange(change);
    setView("analysis");
    setAiLoading(true);
    setAiReport("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regulation: regId(change.reg),
          docType: change.doc_type,
          title: change.title,
          summary: change.summary,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error desconocido");
      setAiReport(d.report || "Sin respuesta.");
    } catch (e: unknown) {
      setAiReport(`## Error al consultar la IA\n\n${e instanceof Error ? e.message : "Error desconocido"}\n\nVerifica que ANTHROPIC_API_KEY esté configurada en las variables de entorno de Vercel.`);
    }
    setAiLoading(false);
  };

  const filtered = ALL_REGS.filter(r => {
    const q = search.toLowerCase();
    return (q === "" || `r${r.n} ${r.title} ${r.cat}`.toLowerCase().includes(q))
      && (catFilter === "Todos" || r.cat === catFilter);
  });

  return (
    <div style={{ fontFamily:T.sans, background:T.bg, minHeight:"100vh", color:T.text }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-thumb{background:${T.border2};border-radius:3px}
        button:hover{filter:brightness(.96)}
        input:focus{outline:none!important;border-color:${T.blue}!important;box-shadow:0 0 0 3px ${T.blue}20!important}

        /* ── RESPONSIVE ── */
        .app-header{padding:0 16px!important;height:auto!important;min-height:56px;flex-wrap:wrap;gap:10px;padding-top:10px!important;padding-bottom:10px!important}
        .header-logo-subtitle{display:block}
        .header-right{gap:10px!important;flex-wrap:wrap;justify-content:flex-end}
        .header-last-check{display:block}
        .app-nav{padding:0 8px!important;overflow-x:auto;-webkit-overflow-scrolling:touch}
        .app-nav button{padding:10px 12px!important;font-size:12px!important;white-space:nowrap}
        .app-content{padding:16px!important}
        .dashboard-grid{display:grid;grid-template-columns:1fr 320px;gap:24px;align-items:start}
        .change-card-inner{display:flex}
        .change-card-action{display:flex;align-items:center;padding:0 16px;border-left:1px solid ${T.border};background:${T.bg}}

        @media(max-width:900px){
          .dashboard-grid{grid-template-columns:1fr!important}
          .sidebar{order:99}
        }
        @media(max-width:640px){
          .app-header{padding:10px 14px!important}
          .header-logo-subtitle{display:none!important}
          .header-last-check{display:none!important}
          .app-content{padding:12px 14px!important}
          .change-card-inner{flex-direction:column!important}
          .change-card-action{border-left:none!important;border-top:1px solid ${T.border}!important;padding:10px 14px!important;justify-content:flex-end}
          .reg-grid{grid-template-columns:1fr 1fr!important}
          .selector-grid{grid-template-columns:1fr!important}
        }
        @media(max-width:400px){
          .reg-grid{grid-template-columns:1fr!important}
        }
      `}</style>

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header className="app-header" style={{ background:T.blueDeep, color:"white", padding:"0 28px", display:"flex", alignItems:"center", gap:0, height:56, flexShrink:0, boxShadow:"0 2px 8px rgba(0,61,107,.25)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:34, height:34, borderRadius:6, background:"rgba(255,255,255,.12)", border:"1px solid rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.5" opacity=".7"/>
              <path d="M12 7v5l3 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M5 12h2M17 12h2M12 5v2M12 17v2" stroke="white" strokeWidth="1" strokeLinecap="round" opacity=".5"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, letterSpacing:"0.02em", opacity:.95 }}>UNECE Regulatory Monitor</div>
            <div className="header-logo-subtitle" style={{ fontSize:10, opacity:.5, letterSpacing:"0.04em" }}>Sistema de vigilancia de reglamentos de homologación</div>
          </div>
        </div>

        <div className="header-right" style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:16 }}>
          {/* Alcance badge */}
          {scope && (
            <div style={{ background:"rgba(34,197,94,.15)", border:"1px solid rgba(34,197,94,.3)", borderRadius:6, padding:"4px 10px", cursor:"pointer" }}
                 onClick={() => setView("scope")} title="Alcance acreditado cargado">
              <div style={{ fontSize:9, opacity:.8, letterSpacing:"0.06em" }}>ALCANCE</div>
              <div style={{ fontFamily:T.mono, fontSize:10, opacity:.9, whiteSpace:"nowrap" as const }}>✓ cargado</div>
            </div>
          )}

          {/* Última revisión */}
          <div className="header-last-check" style={{ textAlign:"right" as const }}>
            <div style={{ fontSize:10, opacity:.5, letterSpacing:"0.04em" }}>ÚLTIMA REVISIÓN</div>
            <div style={{ fontFamily:T.mono, fontSize:11, opacity:.85 }}>
              {lastCheck
                ? new Date(lastCheck).toLocaleString("es-ES", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit", timeZone:"Europe/Madrid" })
                : "—"}
            </div>
          </div>

          {/* Botón realizar revisión ahora */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
            <button
              onClick={triggerScraper}
              disabled={triggering}
              style={{
                background: triggering ? "rgba(255,255,255,.1)" : "rgba(255,255,255,.15)",
                border:"1px solid rgba(255,255,255,.3)",
                color:"white", borderRadius:6, padding:"6px 14px",
                fontSize:11, fontWeight:600, cursor: triggering ? "not-allowed" : "pointer",
                fontFamily:T.sans, letterSpacing:"0.04em", whiteSpace:"nowrap" as const,
                display:"flex", alignItems:"center", gap:6, transition:"all .2s",
              }}
            >
              {triggering ? (
                <><span style={{ display:"inline-block", animation:"spin 1s linear infinite" }}>↻</span> Lanzando…</>
              ) : (
                <>▶ Realizar revisión ahora</>
              )}
            </button>
            {!baselineSet && !lastCheck && !triggering && (
              <div style={{ fontSize:9.5, color:"rgba(255,255,255,.55)", textAlign:"center" as const, maxWidth:140, lineHeight:1.4 }}>
                Primera ejecución: establece la línea base
              </div>
            )}
            {triggerMsg && (
              <div style={{
                position:"absolute", marginTop:52,
                fontSize:11, fontWeight:500, padding:"4px 10px", borderRadius:4,
                background: triggerMsg.startsWith("✓") ? T.okBg : T.warnBg,
                color: triggerMsg.startsWith("✓") ? T.ok : T.warn,
                border:`1px solid ${triggerMsg.startsWith("✓") ? "#bbf7d0" : "#fde68a"}`,
                whiteSpace:"nowrap" as const, zIndex:50,
              }}>
                {triggerMsg}
              </div>
            )}
          </div>

          {/* Botón generar evidencia */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
            <button
              onClick={generateReview}
              disabled={generatingReview || loadingData}
              style={{
                background: generatingReview ? "rgba(255,255,255,.1)" : "rgba(124,58,237,.25)",
                border:"1px solid rgba(167,139,250,.5)",
                color:"white", borderRadius:6, padding:"6px 14px",
                fontSize:11, fontWeight:600, cursor: generatingReview ? "not-allowed" : "pointer",
                fontFamily:T.sans, letterSpacing:"0.04em", whiteSpace:"nowrap" as const,
                display:"flex", alignItems:"center", gap:6, transition:"all .2s",
              }}
            >
              {generatingReview
                ? <><span style={{ display:"inline-block", animation:"spin 1s linear infinite" }}>↻</span> Registrando…</>
                : <>📋 Generar evidencia</>}
            </button>
            {reviewMsg && (
              <div style={{
                position:"absolute", marginTop:52,
                fontSize:11, fontWeight:500, padding:"4px 10px", borderRadius:4,
                background: reviewMsg.startsWith("✓") ? T.okBg : T.warnBg,
                color: reviewMsg.startsWith("✓") ? T.ok : T.warn,
                border:`1px solid ${reviewMsg.startsWith("✓") ? "#bbf7d0" : "#fde68a"}`,
                whiteSpace:"nowrap" as const, zIndex:50,
              }}>
                {reviewMsg}
              </div>
            )}
          </div>

          <div style={{ background:"rgba(255,255,255,.1)", border:"1px solid rgba(255,255,255,.2)", borderRadius:6, padding:"6px 14px", textAlign:"center" as const }}>
            <div style={{ fontFamily:T.mono, fontWeight:700, fontSize:18, lineHeight:1 }}>{monitored.size}</div>
            <div style={{ fontSize:9, opacity:.6, letterSpacing:"0.06em", marginTop:2 }}>VIGILANDO</div>
          </div>
          {monChanges.length > 0 && (
            <div style={{ background:"#dc2626", borderRadius:6, padding:"6px 14px", textAlign:"center" as const, animation:"blink 2s ease-in-out infinite" }}>
              <div style={{ fontFamily:T.mono, fontWeight:700, fontSize:18, lineHeight:1 }}>{monChanges.length}</div>
              <div style={{ fontSize:9, opacity:.9, letterSpacing:"0.06em", marginTop:2 }}>CAMBIOS</div>
            </div>
          )}
        </div>
      </header>

      {/* ── SUBHEADER NAV ────────────────────────────────────────────────── */}
      <div className="app-nav" style={{ background:"white", borderBottom:`2px solid ${T.border}`, display:"flex", padding:"0 28px", gap:0 }}>
        {[
          ["dashboard", "Dashboard"],
          ["selector",  `Reglamentos (${ALL_REGS.length})`],
          ["analysis",  "Análisis IA"],
          ["scope",     scope ? "Alcance ✓" : "Alcance"],
          ["history",   reviews.length > 0 ? `Historial (${reviews.length})` : "Historial"],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setView(id!)} style={{
            padding:"12px 20px", border:"none", background:"transparent", cursor:"pointer",
            fontFamily:T.sans, fontSize:13, fontWeight:600, letterSpacing:"0.02em",
            color: view === id ? T.blueDeep
              : id === "scope" && scope ? T.ok
              : id === "history" && reviews.length > 0 ? "#7c3aed"
              : T.muted,
            borderBottom: `3px solid ${view === id ? T.blue : "transparent"}`,
            marginBottom:-2, transition:"all .15s",
          }}>{label}</button>
        ))}
      </div>

      {/* ── CONTENT ──────────────────────────────────────────────────────── */}
      <div className="app-content" style={{ maxWidth:1200, margin:"0 auto", padding:"24px 28px" }}>

        {/* ════ DASHBOARD ════════════════════════════════════════════════ */}
        {view === "dashboard" && (
          <div className="dashboard-grid" style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:24, alignItems:"start" }}>
            <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

              {/* Baseline established banner */}
              {showBaselineBanner && (
                <div style={{ background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:8, padding:"14px 18px", display:"flex", gap:14, alignItems:"flex-start", animation:"fadeUp .3s ease" }}>
                  <span style={{ fontSize:22, lineHeight:1 }}>📍</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:"#166534", marginBottom:3 }}>Línea base establecida</div>
                    <div style={{ fontSize:12, color:"#15803d", lineHeight:1.5 }}>
                      Esta primera revisión captura el estado actual de los reglamentos seleccionados. No se esperan cambios detectados todavía — a partir de ahora el monitor comparará cada nueva revisión con esta foto inicial y alertará cuando aparezcan modificaciones.
                    </div>
                  </div>
                  <button onClick={() => setShowBaselineBanner(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"#16a34a", fontSize:16, lineHeight:1, padding:0, flexShrink:0 }} title="Cerrar">✕</button>
                </div>
              )}

              {/* Monitored regs grid */}
              <section>
                <h2 style={{ fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.muted, letterSpacing:"0.1em", textTransform:"uppercase" as const, margin:"0 0 12px" }}>
                  Reglamentos monitorizados
                </h2>
                <div className="reg-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))", gap:8 }}>
                  {[...monitored].sort((a, b) => a - b).map(n => {
                    const reg = ALL_REGS.find(r => r.n === n);
                    const hasChange = monChanges.some(c => c.reg === n);
                    return (
                      <div key={n} style={{ background:"white", border:`1.5px solid ${hasChange ? T.cor+"60" : T.border}`,
                        borderRadius:6, padding:"12px 14px", animation:"fadeUp .3s ease",
                        borderLeft:`4px solid ${hasChange ? T.cor : T.blue}`,
                        boxShadow: hasChange ? `0 2px 12px ${T.cor}15` : "0 1px 3px rgba(0,0,0,.04)" }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                          <span style={{ fontFamily:T.mono, fontWeight:700, fontSize:14, color:T.blueDeep }}>{regId(n)}</span>
                          {hasChange
                            ? <StatusPill ok={false} label="Cambio" />
                            : <StatusPill ok={true} label="Sin cambio desde la última revisión" />}
                        </div>
                        <div style={{ fontSize:11.5, color:T.muted, lineHeight:1.4 }}>{reg?.title}</div>
                        <div style={{ fontSize:10, color:T.dim, marginTop:4, fontFamily:T.mono }}>{reg?.cat}</div>
                      </div>
                    );
                  })}
                  {monitored.size === 0 && (
                    <div style={{ gridColumn:"1/-1", textAlign:"center" as const, padding:40, color:T.muted, background:"white", borderRadius:6, border:`1px dashed ${T.border2}` }}>
                      <div style={{ fontSize:13, marginBottom:14 }}>Sin reglamentos seleccionados</div>
                      <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" as const }}>
                        <button onClick={() => setView("selector")} style={{ background:T.blue, color:"white", border:"none", borderRadius:4, padding:"7px 16px", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                          Añadir reglamentos →
                        </button>
                        <button onClick={() => setView("scope")} style={{ background:"white", color:T.blue, border:`1.5px solid ${T.blue}`, borderRadius:4, padding:"7px 16px", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                          📄 Subir alcance
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Changes feed */}
              <section>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                  <h2 style={{ fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.muted, letterSpacing:"0.1em", textTransform:"uppercase" as const, margin:0 }}>
                    Cambios detectados
                  </h2>
                  {monChanges.length > 0 && (
                    <span style={{ background:T.cor, color:"white", borderRadius:20, padding:"1px 8px", fontSize:10 }}>
                      {monChanges.length}
                    </span>
                  )}
                  {!scope && (
                    <button onClick={() => setView("scope")} style={{
                      marginLeft:"auto", fontSize:10.5, color:T.blue, background:"transparent",
                      border:`1px solid ${T.blue}40`, borderRadius:4, padding:"3px 10px", cursor:"pointer",
                      fontFamily:T.sans, fontWeight:600,
                    }}>
                      + Cargar alcance ISO 17025
                    </button>
                  )}
                </div>

                {loadingData ? (
                  <div style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:6, padding:40, textAlign:"center" as const }}>
                    <div style={{ width:28, height:28, border:`2px solid ${T.blueLight}`, borderTop:`2px solid ${T.blue}`, borderRadius:"50%", margin:"0 auto 12px", animation:"spin 1s linear infinite" }} />
                    <div style={{ fontSize:13, color:T.muted }}>Cargando datos…</div>
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>

                    {/* Demo example card */}
                    {showDemo && (() => {
                      const c = DEMO_CHANGE;
                      const cfg = DOC_CFG[c.doc_type] || {};
                      const clf = classifyRegulatoryChange(c.summary, { reg: c.reg, doc_type: c.doc_type });
                      return (
                        <div style={{ background:"white", border:`1.5px dashed #fbbf24`, borderRadius:6, overflow:"hidden", boxShadow:"0 1px 6px #fbbf2420", animation:"fadeUp .3s ease" }}>
                          <div style={{ background:"#fffbeb", borderBottom:"1px dashed #fde68a", padding:"6px 18px", display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ fontSize:11, fontWeight:700, color:"#92400e", letterSpacing:"0.06em" }}>EJEMPLO — así se muestra un cambio detectado</span>
                            <button onClick={dismissDemo} style={{ marginLeft:"auto", fontSize:11, color:"#92400e", background:"transparent", border:"1px solid #fde68a", borderRadius:4, padding:"2px 10px", cursor:"pointer", fontFamily:T.sans, fontWeight:600 }}>
                              Eliminar ejemplo
                            </button>
                          </div>
                          <div className="change-card-inner" style={{ display:"flex" }}>
                            <div style={{ width:5, background:cfg.color || T.blue, flexShrink:0 }} />
                            <div style={{ flex:1, padding:"14px 18px" }}>
                              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                                <span style={{ fontFamily:T.mono, fontWeight:700, fontSize:13, color:T.blueDeep }}>{regId(c.reg)}</span>
                                <TypeBadge type={c.doc_type} />
                                <span style={{ fontSize:11, color:T.muted, marginLeft:"auto" }}>{fmtDate(c.timestamp)}</span>
                              </div>
                              <div style={{ fontSize:13.5, fontWeight:600, color:T.text, marginBottom:5 }}>{c.title}</div>
                              <div style={{ fontSize:12, color:T.muted, lineHeight:1.5 }}>{c.summary}</div>
                              <div style={{ display:"flex", gap:8, marginTop:10, alignItems:"center", flexWrap:"wrap" as const }}>
                                {c.has_pdf && <span style={{ fontFamily:T.mono, fontSize:9, color:T.ok, border:`1px solid ${T.ok}40`, background:T.okBg, padding:"2px 7px", borderRadius:3 }}>↓ PDF descargado</span>}
                                {c.has_prev && <span style={{ fontFamily:T.mono, fontSize:9, color:"#7c3aed", border:"1px solid #ddd6fe", background:"#faf5ff", padding:"2px 7px", borderRadius:3 }}>◈ Versión anterior disponible</span>}
                              </div>
                              <ImpactBadge clf={clf} />
                            </div>
                            <div className="change-card-action" style={{ display:"flex", alignItems:"center", padding:"0 16px", borderLeft:`1px solid ${T.border}`, background:T.bg }}>
                              <button disabled style={{
                                background:T.muted, color:"white", border:"none", borderRadius:5,
                                padding:"9px 16px", fontSize:12, fontWeight:600, cursor:"not-allowed",
                                fontFamily:T.sans, whiteSpace:"nowrap" as const, letterSpacing:"0.02em", opacity:0.5,
                              }}>Analizar IA →</button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Real changes */}
                    {monChanges.map(c => {
                      const cfg = DOC_CFG[c.doc_type] || {};
                      const clf = classifyRegulatoryChange(c.summary, { reg: c.reg, doc_type: c.doc_type });
                      const scopeMatch = scope
                        ? matchChangeAgainstScope({ reg: c.reg, title: c.title, summary: c.summary, doc_type: c.doc_type }, scope)
                        : null;

                      return (
                        <div key={c.id} style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:6, overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,.04)", animation:"fadeUp .3s ease" }}>
                          <div className="change-card-inner" style={{ display:"flex" }}>
                            <div style={{ width:5, background:cfg.color || T.blue, flexShrink:0 }} />
                            <div style={{ flex:1, padding:"14px 18px" }}>
                              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                                <span style={{ fontFamily:T.mono, fontWeight:700, fontSize:13, color:T.blueDeep }}>{regId(c.reg)}</span>
                                <TypeBadge type={c.doc_type} />
                                <span style={{ fontSize:11, color:T.muted, marginLeft:"auto" }}>{fmtDate(c.timestamp)}</span>
                              </div>
                              <div style={{ fontSize:13.5, fontWeight:600, color:T.text, marginBottom:5 }}>{c.title}</div>
                              <div style={{ fontSize:12, color:T.muted, lineHeight:1.5 }}>{c.summary}</div>
                              <div style={{ display:"flex", gap:8, marginTop:10, alignItems:"center", flexWrap:"wrap" as const }}>
                                {c.has_pdf && <span style={{ fontFamily:T.mono, fontSize:9, color:T.ok, border:`1px solid ${T.ok}40`, background:T.okBg, padding:"2px 7px", borderRadius:3 }}>↓ PDF descargado</span>}
                                {c.has_prev && <span style={{ fontFamily:T.mono, fontSize:9, color:"#7c3aed", border:"1px solid #ddd6fe", background:"#faf5ff", padding:"2px 7px", borderRadius:3 }}>◈ Versión anterior disponible</span>}
                              </div>
                              <ImpactBadge clf={clf} />
                              {scopeMatch && <ScopeMatchRow match={scopeMatch} />}
                            </div>
                            <div className="change-card-action" style={{ display:"flex", alignItems:"center", padding:"0 16px", borderLeft:`1px solid ${T.border}`, background:T.bg }}>
                              <button onClick={() => requestAnalysis(c)} style={{
                                background:T.blue, color:"white", border:"none", borderRadius:5,
                                padding:"9px 16px", fontSize:12, fontWeight:600, cursor:"pointer",
                                fontFamily:T.sans, whiteSpace:"nowrap" as const, letterSpacing:"0.02em",
                              }}>Analizar IA →</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Empty state — only when no demo and no real changes */}
                    {!showDemo && monChanges.length === 0 && (
                      <div style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:6, padding:40, textAlign:"center" as const }}>
                        <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
                        <div style={{ fontSize:14, color:T.body, fontWeight:500 }}>Todos los reglamentos están actualizados</div>
                        <div style={{ fontSize:12, color:T.muted, marginTop:4 }}>Sin cambios en el período monitorizado</div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>

            {/* RIGHT sidebar */}
            <div className="sidebar" style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {[
                { label:"Reglamentos vigilados", value:monitored.size,                                                         color:T.blueDeep },
                { label:"Cambios detectados",    value:monChanges.length,                                                      color:monChanges.length > 0 ? T.cor : T.ok },
                { label:"Amendments",            value:monChanges.filter(c => c.doc_type === "AMENDMENT").length,   color:"#7c3aed" },
                { label:"Corrigenda",            value:monChanges.filter(c => c.doc_type === "CORRIGENDUM").length, color:T.cor },
                { label:"Revisiones",            value:monChanges.filter(c => c.doc_type === "REVISION").length,    color:T.blue },
              ].map((s, i) => (
                <div key={i} style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:6, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:12.5, color:T.body }}>{s.label}</span>
                  <span style={{ fontFamily:T.mono, fontWeight:700, fontSize:22, color:s.color }}>{s.value}</span>
                </div>
              ))}

              {/* Impact breakdown for monitored changes */}
              {monChanges.length > 0 && (() => {
                const clfs = monChanges.map(c => classifyRegulatoryChange(c.summary, { doc_type: c.doc_type }));
                const counts = { red: 0, orange: 0, yellow: 0, green: 0 };
                clfs.forEach(clf => counts[clf.impactLevel]++);
                return (
                  <div style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:6, padding:16 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:T.muted, letterSpacing:"0.08em", textTransform:"uppercase" as const, marginBottom:12 }}>Nivel de impacto</div>
                    {(["red","orange","yellow","green"] as const).map(lvl => {
                      const c = IMPACT_COLORS[lvl];
                      return counts[lvl] > 0 ? (
                        <div key={lvl} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                          <span style={{ width:8, height:8, borderRadius:"50%", background:c.dot, flexShrink:0 }} />
                          <span style={{ fontSize:11.5, color:T.body }}>{c.label}</span>
                          <span style={{ marginLeft:"auto", fontFamily:T.mono, fontWeight:700, fontSize:14, color:c.color }}>{counts[lvl]}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                );
              })()}

              <div style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:6, padding:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:T.muted, letterSpacing:"0.08em", textTransform:"uppercase" as const, marginBottom:12 }}>Tipos de documento</div>
                {Object.entries(DOC_CFG).map(([type, cfg]) => {
                  const [open, setOpen] = [expandedDocType === type, (v: boolean) => setExpandedDocType(v ? type : null)];
                  return (
                    <div key={type} style={{ marginBottom:6 }}>
                      <div
                        onClick={() => setOpen(!open)}
                        style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", padding:"4px 0", userSelect:"none" as const }}
                      >
                        <span style={{ fontSize:14 }}>{cfg.icon}</span>
                        <TypeBadge type={type} />
                        <span style={{ fontSize:11.5, color:T.muted, flex:1 }}>{cfg.label}</span>
                        <span style={{ fontSize:10, color:T.dim, transition:"transform .2s", display:"inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
                      </div>
                      {open && (
                        <div style={{ fontSize:11.5, color:T.body, lineHeight:1.6, padding:"6px 10px 4px 34px", background:cfg.bg, borderRadius:5, marginTop:2 }}>
                          {cfg.desc}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ background: autorun === false ? "#fef9ec" : T.blueLight, border:`1px solid ${autorun === false ? "#fde68a" : T.blue + "30"}`, borderRadius:6, padding:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color: autorun === false ? "#92400e" : T.blueDeep, letterSpacing:"0.08em", textTransform:"uppercase" as const, marginBottom:8 }}>Ejecución automática</div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                  <div>
                    <div style={{ fontFamily:T.mono, fontSize:12, color: autorun === false ? "#92400e" : T.blueDeep, fontWeight:700 }}>
                      {autorun === null ? "Cargando…" : autorun ? "Mañana 09:00 CET" : "⏸ Pausada"}
                    </div>
                    <div style={{ fontSize:11, color: autorun === false ? "#b45309" : T.blueMid, marginTop:3 }}>GitHub Actions · cron diario</div>
                  </div>
                  <button
                    onClick={toggleAutorun}
                    disabled={autorunSaving || autorun === null}
                    style={{
                      padding:"5px 12px", borderRadius:5, fontSize:11, fontWeight:700, cursor: autorunSaving || autorun === null ? "not-allowed" : "pointer",
                      border:"none", transition:"background .2s",
                      background: autorun ? "#dc2626" : "#16a34a",
                      color:"white", opacity: autorunSaving || autorun === null ? .6 : 1,
                    }}
                  >
                    {autorunSaving ? "…" : autorun ? "Pausar" : "Activar"}
                  </button>
                </div>
              </div>

              {/* Reviewer name — always visible so it's set before generating */}
              <div style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:6, padding:"10px 14px" }}>
                <div style={{ fontSize:10, fontWeight:700, color:T.muted, letterSpacing:"0.08em", textTransform:"uppercase" as const, marginBottom:7 }}>Revisor</div>
                <input
                  value={reviewerName}
                  onChange={e => { setReviewerName(e.target.value); saveReviewerName(e.target.value); }}
                  placeholder="Nombre del técnico responsable…"
                  style={{ width:"100%", boxSizing:"border-box" as const, border:`1.5px solid ${T.border2}`, borderRadius:5, padding:"6px 10px", fontFamily:T.sans, fontSize:12, color:T.text, background:T.bg }}
                />
              </div>

              {/* Scope summary in sidebar */}
              {scope ? (
                <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:6, padding:16 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#15803d", letterSpacing:"0.08em", textTransform:"uppercase" as const, marginBottom:8 }}>
                    Alcance ISO 17025
                  </div>
                  <div style={{ fontSize:12, color:"#166534", fontWeight:500, wordBreak:"break-all" as const }}>{scope.fileName}</div>
                  <div style={{ fontSize:11, color:"#16a34a", marginTop:6, display:"flex", flexDirection:"column", gap:2 }}>
                    <div>{scope.extractedReferences.length} referencias extraídas</div>
                    <div>{scope.testMethods.length} métodos detectados</div>
                    <div>{scope.pageCount} páginas</div>
                  </div>
                  <button onClick={() => setView("scope")} style={{
                    marginTop:10, width:"100%", background:"transparent", border:"1px solid #86efac",
                    color:"#15803d", borderRadius:4, padding:"5px 0", fontSize:11.5, fontWeight:600,
                    cursor:"pointer", fontFamily:T.sans,
                  }}>Ver alcance →</button>
                </div>
              ) : (
                <div style={{ background:T.warnBg, border:`1px solid #fde68a`, borderRadius:6, padding:16 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:T.warn, letterSpacing:"0.08em", textTransform:"uppercase" as const, marginBottom:6 }}>
                    Alcance ISO 17025
                  </div>
                  <div style={{ fontSize:11.5, color:T.warn, marginBottom:10 }}>No hay alcance acreditado cargado. Carga tu PDF para activar el mapa de afectación.</div>
                  <button onClick={() => setView("scope")} style={{
                    width:"100%", background:T.warn, border:"none",
                    color:"white", borderRadius:4, padding:"7px 0", fontSize:12, fontWeight:600,
                    cursor:"pointer", fontFamily:T.sans,
                  }}>Cargar alcance →</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════ SELECTOR ══════════════════════════════════════════════════ */}
        {view === "selector" && (
          <div style={{ animation:"fadeUp .3s ease" }}>
            <div style={{ background:"white", borderRadius:8, border:`1px solid ${T.border}`, padding:20, marginBottom:20 }}>
              <div style={{ display:"flex", gap:12, marginBottom:16 }}>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por número (R17), nombre o categoría…"
                  style={{ flex:1, border:`1.5px solid ${T.border2}`, borderRadius:6, padding:"9px 14px", fontFamily:T.sans, fontSize:13, color:T.text, background:T.bg, transition:"all .2s" }} />
                <span style={{ fontFamily:T.mono, fontSize:12, color:T.muted, alignSelf:"center", whiteSpace:"nowrap" as const }}>
                  {[...monitored].length} / {ALL_REGS.length}
                </span>
              </div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap" as const, gap:8 }}>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" as const }}>
                  {CATS.map(cat => (
                    <button key={cat} onClick={() => setCatFilter(cat)} style={{
                      padding:"4px 12px", borderRadius:20,
                      border:`1.5px solid ${catFilter === cat ? T.blue : T.border2}`,
                      background: catFilter === cat ? T.blueLight : "transparent",
                      color: catFilter === cat ? T.blueDeep : T.muted,
                      fontFamily:T.sans, fontSize:11.5, fontWeight:catFilter === cat ? 600 : 400, cursor:"pointer",
                    }}>{cat}</button>
                  ))}
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <button
                    onClick={() => setMonitored(new Set(filtered.map(r => r.n)))}
                    style={{ padding:"4px 14px", borderRadius:20, border:`1.5px solid ${T.blue}`, background:T.blueLight, color:T.blueDeep, fontFamily:T.sans, fontSize:11.5, fontWeight:600, cursor:"pointer" }}
                  >
                    Seleccionar {filtered.length < ALL_REGS.length ? "filtrados" : "todos"}
                  </button>
                  <button
                    onClick={() => setMonitored(prev => { const s = new Set(prev); filtered.forEach(r => s.delete(r.n)); return s; })}
                    style={{ padding:"4px 14px", borderRadius:20, border:`1.5px solid ${T.border2}`, background:"white", color:T.muted, fontFamily:T.sans, fontSize:11.5, fontWeight:600, cursor:"pointer" }}
                  >
                    Deseleccionar {filtered.length < ALL_REGS.length ? "filtrados" : "todos"}
                  </button>
                </div>
              </div>
            </div>

            <div className="selector-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))", gap:6 }}>
              {filtered.map(r => {
                const isOn = monitored.has(r.n);
                const hasChange = allChanges.some(c => c.reg === r.n);
                return (
                  <div key={r.n} onClick={() => toggleReg(r.n)} style={{
                    background: isOn ? T.blueLight : "white",
                    border:`1.5px solid ${isOn ? T.blue+"60" : T.border}`,
                    borderRadius:6, padding:"10px 14px", cursor:"pointer",
                    display:"flex", alignItems:"center", gap:12, transition:"all .15s",
                    boxShadow: isOn ? `0 0 0 1px ${T.blue}30` : "none",
                  }}>
                    <div style={{ width:18, height:18, borderRadius:4,
                      border:`2px solid ${isOn ? T.blue : T.border2}`,
                      background: isOn ? T.blue : "transparent",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      flexShrink:0, fontSize:10, color:"white", fontWeight:700, transition:"all .15s" }}>
                      {isOn ? "✓" : ""}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontFamily:T.mono, fontSize:12, fontWeight:700, color:isOn ? T.blueDeep : T.text }}>{regId(r.n)}</span>
                        {hasChange && <span style={{ width:6, height:6, borderRadius:"50%", background:T.cor, boxShadow:`0 0 4px ${T.cor}` }} />}
                      </div>
                      <div style={{ fontSize:11.5, color:T.muted, marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const }}>{r.title}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════ ANALYSIS ══════════════════════════════════════════════════ */}
        {view === "analysis" && (
          <div style={{ animation:"fadeUp .3s ease", maxWidth:780 }}>
            {!selectedChange ? (
              <div style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:8, padding:80, textAlign:"center" as const }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
                <div style={{ fontSize:15, fontWeight:600, color:T.body }}>Sin análisis activo</div>
                <div style={{ fontSize:13, color:T.muted, marginTop:6 }}>Selecciona un cambio en el Dashboard y pulsa &quot;Analizar IA&quot;</div>
                <button onClick={() => setView("dashboard")} style={{ marginTop:16, background:T.blue, color:"white", border:"none", borderRadius:5, padding:"9px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:T.sans }}>
                  Ir al Dashboard
                </button>
              </div>
            ) : (
              <>
                <div style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:8, padding:"16px 20px", marginBottom:16, display:"flex", alignItems:"center", gap:12, boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
                  <span style={{ fontFamily:T.mono, fontWeight:700, fontSize:15, color:T.blueDeep }}>{regId(selectedChange.reg)}</span>
                  <TypeBadge type={selectedChange.doc_type} size="md" />
                  <span style={{ fontSize:13.5, color:T.body, fontWeight:500, flex:1 }}>{selectedChange.title}</span>
                  {!aiLoading && aiReport && <StatusPill ok={true} label="Análisis completado" />}
                </div>

                {aiLoading && (
                  <div style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:8, padding:70, textAlign:"center" as const }}>
                    <div style={{ width:36, height:36, border:`3px solid ${T.blueLight}`, borderTop:`3px solid ${T.blue}`, borderRadius:"50%", margin:"0 auto 20px", animation:"spin 1s linear infinite" }} />
                    <div style={{ fontSize:14, fontWeight:600, color:T.body }}>Analizando con IA…</div>
                    <div style={{ fontSize:12, color:T.muted, marginTop:6 }}>Claude está comparando ambas versiones del reglamento</div>
                  </div>
                )}

                {!aiLoading && aiReport && (
                  <div style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:8, padding:28, boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
                    <MarkdownReport text={aiReport} />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ════ ALCANCE ACREDITADO ════════════════════════════════════════ */}
        {view === "scope" && (
          <div style={{ animation:"fadeUp .3s ease", maxWidth:860 }}>

            {/* Page header */}
            <div style={{ marginBottom:24 }}>
              <h1 style={{ fontFamily:T.sans, fontSize:20, fontWeight:700, color:T.blueDeep, margin:"0 0 6px" }}>
                Alcance acreditado ISO/IEC 17025
              </h1>
              <p style={{ fontSize:13, color:T.muted, margin:0 }}>
                Sube el PDF de tu alcance de acreditación para activar el mapa de afectación automático sobre los cambios detectados.
              </p>
            </div>

            {/* ENAC recommendation banner */}
            <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:8, padding:"14px 18px", marginBottom:16, display:"flex", gap:12, alignItems:"flex-start" }}>
              <span style={{ fontSize:20, flexShrink:0 }}>ℹ️</span>
              <div>
                <div style={{ fontSize:12.5, fontWeight:700, color:"#1e40af", marginBottom:4 }}>
                  Usa el PDF oficial del anexo técnico de ENAC
                </div>
                <div style={{ fontSize:12, color:"#1d4ed8", lineHeight:1.6 }}>
                  Para garantizar que el texto sea legible y los reglamentos se detecten correctamente, descarga el alcance directamente desde el{" "}
                  <strong>buscador de entidades acreditadas de ENAC</strong>{" "}
                  (enac.es → Entidades acreditadas → busca tu laboratorio → descarga el Anexo Técnico en PDF).
                  Ese PDF contiene el texto embebido y es compatible con el extractor automático.
                </div>
              </div>
            </div>

            {/* Upload card */}
            <div style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:8, padding:28, marginBottom:20, boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
              <div style={{ fontSize:12, fontWeight:700, color:T.muted, letterSpacing:"0.08em", textTransform:"uppercase" as const, marginBottom:16 }}>
                Documento de alcance
              </div>

              {/* Drop zone / upload area */}
              <div
                onClick={() => !scopeUploading && fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) handlePdfUpload(f);
                }}
                style={{
                  border:`2px dashed ${scopeUploading ? T.blue : T.border2}`,
                  borderRadius:8, padding:"32px 24px", textAlign:"center" as const,
                  cursor: scopeUploading ? "not-allowed" : "pointer",
                  background: scopeUploading ? T.blueFaint : T.bg,
                  transition:"all .2s",
                  marginBottom:16,
                }}
              >
                {scopeUploading ? (
                  <>
                    <div style={{ width:36, height:36, border:`3px solid ${T.blueLight}`, borderTop:`3px solid ${T.blue}`, borderRadius:"50%", margin:"0 auto 16px", animation:"spin 1s linear infinite" }} />
                    <div style={{ fontSize:14, fontWeight:600, color:T.blueDeep }}>Procesando PDF…</div>
                    <div style={{ fontSize:12, color:T.muted, marginTop:4 }}>Extrayendo texto y referencias</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize:36, marginBottom:12 }}>📄</div>
                    <div style={{ fontSize:14, fontWeight:600, color:T.body, marginBottom:6 }}>
                      {scope ? "Reemplazar PDF de alcance" : "Subir PDF de alcance"}
                    </div>
                    <div style={{ fontSize:12, color:T.muted }}>
                      Arrastra aquí o haz clic para seleccionar · Solo PDF · Máximo 10 MB
                    </div>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                style={{ display:"none" }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handlePdfUpload(f);
                  e.target.value = "";
                }}
              />

              {/* URL input */}
              <div style={{ display:"flex", alignItems:"center", gap:8, margin:"4px 0 12px" }}>
                <div style={{ flex:1, height:1, background:T.border }} />
                <span style={{ fontSize:11, color:T.dim, whiteSpace:"nowrap" as const }}>o pega la URL del certificado ENAC</span>
                <div style={{ flex:1, height:1, background:T.border }} />
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <input
                  id="enac-url-input"
                  type="url"
                  placeholder="https://www.enac.es/documents/…"
                  disabled={scopeUploading}
                  style={{
                    flex:1, border:`1.5px solid ${T.border2}`, borderRadius:6,
                    padding:"8px 12px", fontFamily:T.sans, fontSize:12.5,
                    color:T.text, background: scopeUploading ? T.bg : "white",
                  }}
                />
                <button
                  disabled={scopeUploading}
                  onClick={async () => {
                    const input = document.getElementById("enac-url-input") as HTMLInputElement;
                    const url = input?.value?.trim();
                    if (!url) return;
                    setScopeUploading(true);
                    setScopeError(null);
                    setScopeSuccess(null);
                    try {
                      const res = await fetch("/api/fetch-scope-pdf", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ url }),
                      });
                      if (!res.ok) {
                        const d = await res.json().catch(() => ({})) as { error?: string };
                        throw new Error(d.error ?? `Error ${res.status}`);
                      }
                      const blob = await res.blob();
                      const fileName = url.split("/").pop()?.replace(/[?#].*/, "") || "enac-alcance.pdf";
                      const file = new File([blob], fileName.endsWith(".pdf") ? fileName : fileName + ".pdf", { type: "application/pdf" });
                      if (input) input.value = "";
                      await handlePdfUpload(file);
                    } catch (e: unknown) {
                      setScopeError(`✗ ${e instanceof Error ? e.message : "Error al descargar el PDF"}`);
                      setScopeUploading(false);
                    }
                  }}
                  style={{
                    background: scopeUploading ? T.border2 : T.blue, color:"white", border:"none",
                    borderRadius:6, padding:"8px 18px", fontSize:12.5, fontWeight:600,
                    cursor: scopeUploading ? "not-allowed" : "pointer", fontFamily:T.sans, whiteSpace:"nowrap" as const,
                  }}
                >
                  Cargar URL
                </button>
              </div>

              {/* Messages */}
              {scopeError && (
                <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:6, padding:"10px 14px", fontSize:12.5, color:"#b91c1c", display:"flex", alignItems:"center", gap:8 }}>
                  <span>✗</span> {scopeError}
                </div>
              )}
              {scopeSuccess && (
                <div style={{ background:T.okBg, border:`1px solid #bbf7d0`, borderRadius:6, padding:"10px 14px", fontSize:12.5, color:T.ok, display:"flex", alignItems:"center", gap:8 }}>
                  <span>✓</span> {scopeSuccess}
                </div>
              )}
            </div>

            {/* Scope results */}
            {scope && (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

                {/* Scope summary */}
                <div style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:8, padding:20, boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, marginBottom:16 }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:T.text, marginBottom:4 }}>{scope.fileName}</div>
                      <div style={{ fontSize:11.5, color:T.muted }}>
                        Cargado el {new Date(scope.uploadedAt).toLocaleString("es-ES", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit", timeZone:"Europe/Madrid" })}
                        {" · "}{scope.pageCount} páginas
                      </div>
                    </div>
                    <button onClick={clearScope} style={{
                      background:"transparent", border:`1px solid ${T.border2}`,
                      color:T.muted, borderRadius:4, padding:"5px 12px", fontSize:11.5,
                      cursor:"pointer", fontFamily:T.sans, whiteSpace:"nowrap" as const,
                    }}>
                      Eliminar alcance
                    </button>
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:10 }}>
                    {[
                      { label:"Referencias extraídas", value:scope.extractedReferences.length, color:T.blue },
                      { label:"Métodos detectados",    value:scope.testMethods.length,         color:"#7c3aed" },
                      { label:"Categorías producto",   value:scope.productCategories.length,   color:T.sup },
                      { label:"Códigos internos",      value:scope.internalCodes.length,       color:T.ok },
                    ].map((s, i) => (
                      <div key={i} style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:6, padding:"10px 14px", textAlign:"center" as const }}>
                        <div style={{ fontFamily:T.mono, fontWeight:700, fontSize:22, color:s.color }}>{s.value}</div>
                        <div style={{ fontSize:10.5, color:T.muted, marginTop:3 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Detected references + regulation chips — unified section */}
                {(() => {
                  // Union: numbers from raw text + numbers parsed from each reference string
                  const numsFromText = extractRegNums(scope.rawText);
                  const numsFromRefs = new Set<number>();
                  scope.extractedReferences.forEach(ref => extractRegNums(ref).forEach(n => numsFromRefs.add(n)));
                  const scopeNums = [...new Set([...numsFromText, ...numsFromRefs])].sort((a, b) => a - b);

                  const hasAny = scopeNums.length > 0 || scope.extractedReferences.length > 0;
                  if (!hasAny) return null;

                  const unmonitored = scopeNums.filter(n => !monitored.has(n));
                  return (
                    <div style={{ background:"white", border:`1.5px solid ${T.blue}40`, borderRadius:8, padding:20, boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
                      {/* Header */}
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap" as const, gap:10, marginBottom:16 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:T.muted, letterSpacing:"0.08em", textTransform:"uppercase" as const }}>
                          Referencias detectadas en el alcance
                        </div>
                        {scopeNums.length > 0 && (
                          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" as const }}>
                            <button
                              onClick={() => setMonitored(prev => { const s = new Set(prev); scopeNums.forEach(n => s.add(n)); return s; })}
                              style={{ background:T.blue, color:"white", border:"none", borderRadius:6, padding:"7px 16px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:T.sans, whiteSpace:"nowrap" as const }}
                            >
                              ＋ Añadir todos a vigilancia
                            </button>
                            {unmonitored.length === 0 && (
                              <span style={{ fontSize:11, color:T.ok, fontWeight:600 }}>✓ Todos en vigilancia</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Regulation number chips — clickable, each toggles vigilancia */}
                      {scopeNums.length > 0 && (
                        <>
                          <div style={{ fontSize:10, fontWeight:700, color:T.dim, letterSpacing:"0.07em", textTransform:"uppercase" as const, marginBottom:6 }}>
                            Reglamentos UNECE / ECE
                          </div>
                          <div style={{ display:"flex", flexWrap:"wrap" as const, gap:6, marginBottom:14 }}>
                            {scopeNums.map(n => {
                              const reg = ALL_REGS.find(r => r.n === n);
                              const isOn = monitored.has(n);
                              return (
                                <button
                                  key={n}
                                  onClick={() => toggleReg(n)}
                                  title={reg?.title ?? `UN Regulation ${n} — haz clic para activar/desactivar vigilancia`}
                                  style={{
                                    fontFamily:T.mono, fontSize:11, padding:"4px 11px", borderRadius:5, cursor:"pointer",
                                    border:`1.5px solid ${isOn ? T.blue : T.border2}`,
                                    background: isOn ? T.blueLight : "white",
                                    color: isOn ? T.blueDeep : T.muted,
                                    fontWeight: isOn ? 700 : 500,
                                    transition:"all .15s",
                                  }}
                                >
                                  {isOn ? "✓ " : ""}{regId(n)}{!reg ? " *" : ""}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}

                      {/* Unresolved references — only show strings that don't map to any reg number */}
                      {(() => {
                        const unresolved = scope.extractedReferences.filter(ref => extractRegNums(ref).size === 0);
                        if (unresolved.length === 0) return null;
                        return (
                          <>
                            <div style={{ fontSize:10, fontWeight:700, color:T.dim, letterSpacing:"0.07em", textTransform:"uppercase" as const, marginBottom:6 }}>
                              Otras referencias normativas
                            </div>
                            <div style={{ display:"flex", flexWrap:"wrap" as const, gap:5 }}>
                              {unresolved.map((ref, i) => (
                                <span key={i} style={{
                                  fontFamily:T.mono, fontSize:10, padding:"2px 8px",
                                  background:T.bg, color:T.muted,
                                  border:`1px solid ${T.border}`, borderRadius:4,
                                }}>{ref}</span>
                              ))}
                            </div>
                          </>
                        );
                      })()}

                      {scopeNums.some(n => !ALL_REGS.find(r => r.n === n)) && (
                        <div style={{ fontSize:10, color:T.dim, marginTop:10 }}>
                          <span style={{ color:T.warn }}>*</span> Reglamento detectado no incluido aún en el catálogo del monitor.
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Test methods */}
                {scope.testMethods.length > 0 && (
                  <div style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:8, padding:20, boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
                    <div style={{ fontSize:12, fontWeight:700, color:T.muted, letterSpacing:"0.08em", textTransform:"uppercase" as const, marginBottom:14 }}>
                      Métodos de ensayo detectados ({scope.testMethods.length})
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:260, overflowY:"auto" }}>
                      {scope.testMethods.map((m, i) => (
                        <div key={i} style={{ fontSize:11.5, color:T.body, padding:"5px 10px", background:T.bg, borderRadius:4, border:`1px solid ${T.border}` }}>
                          {m}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Product categories */}
                {scope.productCategories.length > 0 && (
                  <div style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:8, padding:20, boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
                    <div style={{ fontSize:12, fontWeight:700, color:T.muted, letterSpacing:"0.08em", textTransform:"uppercase" as const, marginBottom:14 }}>
                      Categorías de producto / ámbito
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap" as const, gap:6 }}>
                      {scope.productCategories.map((cat, i) => (
                        <span key={i} style={{
                          fontSize:11, padding:"3px 10px",
                          background:"#faf5ff", color:"#7c3aed",
                          border:"1px solid #ddd6fe", borderRadius:4,
                        }}>{cat}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Internal codes */}
                {scope.internalCodes.length > 0 && (
                  <div style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:8, padding:20, boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
                    <div style={{ fontSize:12, fontWeight:700, color:T.muted, letterSpacing:"0.08em", textTransform:"uppercase" as const, marginBottom:14 }}>
                      Códigos internos detectados
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap" as const, gap:6 }}>
                      {scope.internalCodes.map((code, i) => (
                        <span key={i} style={{
                          fontFamily:T.mono, fontSize:10.5, padding:"3px 10px",
                          background:T.okBg, color:T.ok,
                          border:`1px solid ${T.ok}30`, borderRadius:4,
                        }}>{code}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scope vs monitored changes */}
                {monChanges.length > 0 && (
                  <div style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:8, padding:20, boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
                    <div style={{ fontSize:12, fontWeight:700, color:T.muted, letterSpacing:"0.08em", textTransform:"uppercase" as const, marginBottom:14 }}>
                      Cruce con cambios detectados
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {monChanges.map(c => {
                        const m = matchChangeAgainstScope({ reg: c.reg, title: c.title, summary: c.summary, doc_type: c.doc_type }, scope);
                        const clf = classifyRegulatoryChange(c.summary, { doc_type: c.doc_type });
                        const ic = IMPACT_COLORS[clf.impactLevel];
                        return (
                          <div key={c.id} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"12px 14px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:6 }}>
                            <div style={{ flexShrink:0, display:"flex", flexDirection:"column", gap:4, alignItems:"center" }}>
                              <span style={{ fontFamily:T.mono, fontWeight:700, fontSize:12, color:T.blueDeep }}>{regId(c.reg)}</span>
                              <span style={{ width:10, height:10, borderRadius:"50%", background:ic.dot }} title={ic.label} />
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:12.5, fontWeight:600, color:T.text, marginBottom:3 }}>{c.title}</div>
                              <div style={{ fontSize:11, color:T.muted }}>{m.explanation}</div>
                              {m.matchedReferences.length > 0 && (
                                <div style={{ display:"flex", flexWrap:"wrap" as const, gap:4, marginTop:6 }}>
                                  {m.matchedReferences.map((r, i) => (
                                    <span key={i} style={{ fontFamily:T.mono, fontSize:9.5, padding:"2px 7px", background:T.blueLight, color:T.blueDeep, border:`1px solid ${T.blue}20`, borderRadius:3 }}>{r}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div style={{ flexShrink:0, textAlign:"center" as const }}>
                              {m.isAffected ? (
                                <span style={{ fontSize:10, fontWeight:700, color:"#b91c1c", background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:4, padding:"3px 8px" }}>Afectado</span>
                              ) : m.matchScore > 0 ? (
                                <span style={{ fontSize:10, fontWeight:700, color:"#92400e", background:"#fffbeb", border:"1px solid #fde68a", borderRadius:4, padding:"3px 8px" }}>Revisar</span>
                              ) : (
                                <span style={{ fontSize:10, color:T.dim, background:T.bg, border:`1px solid ${T.border}`, borderRadius:4, padding:"3px 8px" }}>Sin afectación</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* CTA to go to dashboard */}
                <div style={{ textAlign:"center" as const, marginTop:8 }}>
                  <button onClick={() => setView("dashboard")} style={{
                    background:T.blue, color:"white", border:"none", borderRadius:6,
                    padding:"10px 24px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:T.sans,
                  }}>
                    Ver cambios con mapa de afectación →
                  </button>
                </div>
              </div>
            )}

            {!scope && !scopeUploading && (
              <div style={{ background:T.blueLight, border:`1px solid ${T.blue}20`, borderRadius:8, padding:24 }}>
                <div style={{ fontSize:12, fontWeight:700, color:T.blueDeep, letterSpacing:"0.08em", textTransform:"uppercase" as const, marginBottom:12 }}>
                  ¿Cómo funciona?
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {[
                    ["1", "Sube el PDF de tu alcance de acreditación (el documento del ENAC u organismo de acreditación)."],
                    ["2", "El sistema extrae automáticamente referencias normativas, métodos de ensayo y categorías de producto."],
                    ["3", "Cada cambio regulatorio detectado se cruza con tu alcance para identificar posibles afectaciones."],
                    ["4", "Recibes una clasificación de impacto y una recomendación de acción para cada cambio relevante."],
                  ].map(([n, text]) => (
                    <div key={n} style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                      <span style={{ fontFamily:T.mono, fontWeight:700, fontSize:12, color:"white", background:T.blue, borderRadius:"50%", width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{n}</span>
                      <span style={{ fontSize:12.5, color:T.blueDeep, lineHeight:1.5 }}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ HISTORIAL DE REVISIONES ══════════════════════════════════ */}
        {view === "history" && (() => {
          const filtered = reviews.filter(r => {
            if (historyDateFrom && r.reviewDate < historyDateFrom) return false;
            if (historyDateTo   && r.reviewDate > historyDateTo + "T23:59:59") return false;
            return true;
          });

          return (
            <div style={{ animation:"fadeUp .3s ease", maxWidth:920 }}>

              {/* Hidden JSON import input */}
              <input
                ref={jsonImportRef}
                type="file"
                accept="application/json,.json"
                style={{ display:"none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setImportingJson(true);
                  try {
                    const text    = await file.text();
                    const records = parseHistoryJson(text);
                    await importReviews(records);
                    setReviews(await loadAllReviews());
                    setReviewMsg(`✓ ${records.length} revisiones importadas correctamente.`);
                    setTimeout(() => setReviewMsg(null), 5000);
                  } catch (err) {
                    setReviewMsg(`✗ Error al importar: ${err instanceof Error ? err.message : "archivo inválido"}`);
                    setTimeout(() => setReviewMsg(null), 6000);
                  } finally {
                    setImportingJson(false);
                    e.target.value = "";
                  }
                }}
              />

              {/* Page header */}
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, marginBottom:20, flexWrap:"wrap" as const }}>
                <div>
                  <h1 style={{ fontFamily:T.sans, fontSize:20, fontWeight:700, color:T.blueDeep, margin:"0 0 6px" }}>
                    Historial de revisiones
                  </h1>
                  <p style={{ fontSize:13, color:T.muted, margin:0 }}>
                    Registro de vigilancia normativa exportable como evidencia para auditorías ISO/IEC 17025 y ENAC.
                  </p>
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" as const, alignItems:"center" }}>
                  {filtered.length > 0 && (<>
                    <button
                      onClick={async () => {
                        const { generateHistorySummaryPdf } = await import("@/lib/generatePdf");
                        generateHistorySummaryPdf(filtered);
                      }}
                      style={{
                        background:"transparent", border:`1.5px solid #7c3aed`, color:"#7c3aed",
                        borderRadius:6, padding:"8px 14px", fontSize:12, fontWeight:600,
                        cursor:"pointer", fontFamily:T.sans, display:"flex", alignItems:"center", gap:6,
                      }}
                    >
                      ↓ PDF resumen
                    </button>
                    <button
                      onClick={() => downloadCsv(allReviewsToCsv(filtered), `historial-vigilancia-${new Date().toISOString().slice(0,10)}.csv`)}
                      style={{
                        background:"transparent", border:`1.5px solid #7c3aed`, color:"#7c3aed",
                        borderRadius:6, padding:"8px 14px", fontSize:12, fontWeight:600,
                        cursor:"pointer", fontFamily:T.sans, display:"flex", alignItems:"center", gap:6,
                      }}
                    >
                      ↓ CSV historial
                    </button>
                    <button
                      onClick={() => exportHistoryJson(filtered)}
                      style={{
                        background:"transparent", border:`1.5px solid ${T.border2}`, color:T.muted,
                        borderRadius:6, padding:"8px 14px", fontSize:12, fontWeight:600,
                        cursor:"pointer", fontFamily:T.sans, display:"flex", alignItems:"center", gap:6,
                      }}
                      title="Exportar historial como JSON (para backup o importar en otro dispositivo)"
                    >
                      ↓ Guardar copia de seguridad
                    </button>
                  </>)}
                  <button
                    onClick={() => jsonImportRef.current?.click()}
                    disabled={importingJson}
                    style={{
                      background:"transparent", border:`1.5px solid ${T.border2}`, color:T.muted,
                      borderRadius:6, padding:"8px 14px", fontSize:12, fontWeight:600,
                      cursor:"pointer", fontFamily:T.sans,
                    }}
                    title="Importar historial desde un archivo JSON exportado previamente"
                  >
                    {importingJson ? "Importando…" : "↑ Restaurar copia de seguridad"}
                  </button>
                  <button
                    onClick={generateReview}
                    disabled={generatingReview || loadingData}
                    style={{
                      background: T.blue, color:"white", border:"none", borderRadius:6,
                      padding:"9px 18px", fontSize:12, fontWeight:600,
                      cursor: generatingReview ? "not-allowed" : "pointer",
                      fontFamily:T.sans, display:"flex", alignItems:"center", gap:7,
                    }}
                  >
                    {generatingReview ? "Registrando…" : "+ Nueva revisión"}
                  </button>
                </div>
              </div>

              {/* Reviewer name + feedback */}
              <div style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:8, padding:"14px 18px", marginBottom:16, display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" as const }}>
                <label style={{ fontSize:12.5, fontWeight:600, color:T.body, whiteSpace:"nowrap" as const }}>
                  Nombre del revisor:
                </label>
                <input
                  value={reviewerName}
                  onChange={e => {
                    setReviewerName(e.target.value);
                    saveReviewerName(e.target.value);
                  }}
                  placeholder="Técnico responsable de la revisión…"
                  style={{
                    flex:1, minWidth:200, border:`1.5px solid ${T.border2}`, borderRadius:6,
                    padding:"7px 12px", fontFamily:T.sans, fontSize:13, color:T.text, background:T.bg,
                  }}
                />
                <span style={{ fontSize:11.5, color:T.muted }}>
                  Se incluirá en todas las evidencias generadas.
                </span>
                {reviewMsg && (
                  <div style={{
                    marginLeft:"auto", fontSize:12, fontWeight:500, padding:"5px 12px", borderRadius:5,
                    background: reviewMsg.startsWith("✓") ? T.okBg : T.warnBg,
                    color:      reviewMsg.startsWith("✓") ? T.ok : T.warn,
                    border:`1px solid ${reviewMsg.startsWith("✓") ? "#bbf7d0" : "#fde68a"}`,
                  }}>
                    {reviewMsg}
                  </div>
                )}
              </div>

              {/* Filters */}
              <div style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:8, padding:16, marginBottom:20, display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" as const }}>
                <span style={{ fontSize:12, fontWeight:600, color:T.muted, whiteSpace:"nowrap" as const }}>Filtrar por fecha:</span>
                <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" as const }}>
                  <label style={{ fontSize:12, color:T.muted }}>Desde</label>
                  <input type="date" value={historyDateFrom} onChange={e => setHistoryDateFrom(e.target.value)}
                    style={{ border:`1.5px solid ${T.border2}`, borderRadius:5, padding:"5px 10px", fontSize:12, fontFamily:T.sans, color:T.text }} />
                  <label style={{ fontSize:12, color:T.muted }}>Hasta</label>
                  <input type="date" value={historyDateTo} onChange={e => setHistoryDateTo(e.target.value)}
                    style={{ border:`1.5px solid ${T.border2}`, borderRadius:5, padding:"5px 10px", fontSize:12, fontFamily:T.sans, color:T.text }} />
                  {(historyDateFrom || historyDateTo) && (
                    <button onClick={() => { setHistoryDateFrom(""); setHistoryDateTo(""); }}
                      style={{ background:"transparent", border:`1px solid ${T.border2}`, color:T.muted, borderRadius:4, padding:"4px 10px", fontSize:11.5, cursor:"pointer", fontFamily:T.sans }}>
                      Limpiar
                    </button>
                  )}
                </div>

                {/* Quick filters */}
                <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
                  {[
                    { label:"7 días", days:7 },
                    { label:"30 días", days:30 },
                    { label:"Todo", days:0 },
                  ].map(({ label, days }) => (
                    <button key={label} onClick={() => {
                      if (days === 0) { setHistoryDateFrom(""); setHistoryDateTo(""); }
                      else {
                        const from = new Date();
                        from.setDate(from.getDate() - days);
                        setHistoryDateFrom(from.toISOString().slice(0, 10));
                        setHistoryDateTo("");
                      }
                    }} style={{
                      padding:"4px 12px", borderRadius:20, fontSize:11.5, cursor:"pointer", fontFamily:T.sans,
                      border:`1.5px solid ${T.border2}`, background:"transparent", color:T.muted,
                    }}>{label}</button>
                  ))}
                </div>
              </div>

              {/* Review list */}
              {filtered.length === 0 ? (
                <div style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:8, padding:60, textAlign:"center" as const }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
                  <div style={{ fontSize:15, fontWeight:600, color:T.body, marginBottom:6 }}>
                    {reviews.length === 0 ? "Aún no hay revisiones registradas" : "Sin revisiones en el período seleccionado"}
                  </div>
                  <div style={{ fontSize:13, color:T.muted, marginBottom:20 }}>
                    {reviews.length === 0
                      ? 'Pulsa "Nueva revisión" para generar tu primera evidencia de vigilancia.'
                      : "Ajusta el filtro de fechas para ver más revisiones."}
                  </div>
                  {reviews.length === 0 && (
                    <button onClick={generateReview} disabled={generatingReview || loadingData}
                      style={{ background:T.blue, color:"white", border:"none", borderRadius:6, padding:"10px 24px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:T.sans }}>
                      + Nueva revisión
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {filtered.map((review) => {
                    const hasRed    = review.regulationsReviewed.some(r => r.impactLevel === "red");
                    const hasOrange = review.regulationsReviewed.some(r => r.impactLevel === "orange");
                    const statusColor = review.totalWithChanges === 0 ? T.ok
                      : hasRed ? "#b91c1c"
                      : hasOrange ? "#c2410c"
                      : "#92400e";
                    const statusBg = review.totalWithChanges === 0 ? T.okBg
                      : hasRed ? "#fef2f2"
                      : hasOrange ? "#fff7ed"
                      : "#fffbeb";
                    const statusLabel = review.totalWithChanges === 0 ? "Sin cambios"
                      : hasRed ? "Cambios críticos"
                      : hasOrange ? "Cambios técnicos"
                      : "Cambios menores";

                    return (
                      <div key={review.reviewId} style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:8, overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,.04)", animation:"fadeUp .3s ease" }}>
                        {/* Card header */}
                        <div style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 18px", borderBottom:`1px solid ${T.border}` }}>
                          <div style={{ flex:1 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" as const }}>
                              <span style={{ fontFamily:T.mono, fontSize:13, fontWeight:700, color:T.blueDeep }}>
                                {new Date(review.reviewDate).toLocaleDateString("es-ES", { day:"2-digit", month:"long", year:"numeric", timeZone:"Europe/Madrid" })}
                              </span>
                              <span style={{ fontFamily:T.mono, fontSize:11, color:T.muted }}>
                                {new Date(review.reviewDate).toLocaleTimeString("es-ES", { hour:"2-digit", minute:"2-digit" })}
                              </span>
                              <span style={{
                                fontSize:10.5, fontWeight:700, padding:"2px 10px", borderRadius:20,
                                background:statusBg, color:statusColor, border:`1px solid ${statusColor}30`,
                              }}>{statusLabel}</span>
                            </div>
                            <div style={{ fontSize:11, color:T.muted, marginTop:4 }}>
                              Fuente: {review.source} · Revisado por: {review.reviewedBy}
                            </div>
                          </div>

                          {/* Stats */}
                          <div style={{ display:"flex", gap:12, flexShrink:0 }}>
                            {[
                              { label:"Revisados", value:review.totalReviewed,      color:T.blueDeep },
                              { label:"Con cambios", value:review.totalWithChanges, color:review.totalWithChanges > 0 ? "#c2410c" : T.ok },
                              { label:"Sin cambios", value:review.totalWithoutChanges, color:T.ok },
                            ].map((s, i) => (
                              <div key={i} style={{ textAlign:"center" as const }}>
                                <div style={{ fontFamily:T.mono, fontWeight:700, fontSize:18, color:s.color, lineHeight:1 }}>{s.value}</div>
                                <div style={{ fontSize:9.5, color:T.muted, marginTop:2 }}>{s.label}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Regulations with changes (collapsed list) */}
                        {review.totalWithChanges > 0 && (
                          <div style={{ padding:"10px 18px", display:"flex", flexWrap:"wrap" as const, gap:6, borderBottom:`1px solid ${T.border}`, background:T.bg }}>
                            {review.regulationsReviewed.filter(r => r.changeDetected).map(r => {
                              const ic = r.impactLevel ? IMPACT_COLORS[r.impactLevel] : IMPACT_COLORS.yellow;
                              return (
                                <span key={r.regulationId} style={{
                                  fontFamily:T.mono, fontSize:10.5, padding:"3px 9px",
                                  background:ic.bg, color:ic.color, border:`1px solid ${ic.border}`,
                                  borderRadius:4,
                                }} title={r.changeSummary}>{r.regulationId}</span>
                              );
                            })}
                          </div>
                        )}

                        {/* Actions */}
                        <div style={{ padding:"12px 18px", display:"flex", alignItems:"center", gap:8, justifyContent:"flex-end", flexWrap:"wrap" as const }}>
                          <span style={{ fontSize:11, color:T.dim, marginRight:"auto", fontFamily:T.mono }}>
                            ID: {review.reviewId.slice(0, 8)}…
                          </span>
                          <button
                            onClick={async () => {
                              const { generateReviewPdf } = await import("@/lib/generatePdf");
                              generateReviewPdf(review);
                            }}
                            style={{
                              background:T.blue, border:"none",
                              color:"white", borderRadius:5, padding:"6px 16px",
                              fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:T.sans,
                              display:"flex", alignItems:"center", gap:6,
                            }}
                          >
                            ↓ PDF evidencia
                          </button>
                          <button
                            onClick={() => downloadCsv(reviewToCsv(review), reviewFilename(review))}
                            style={{
                              background:"transparent", border:`1.5px solid ${T.blue}`,
                              color:T.blue, borderRadius:5, padding:"6px 14px",
                              fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:T.sans,
                            }}
                          >
                            ↓ CSV
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm("¿Eliminar esta revisión del historial?")) {
                                await deleteReview(review.reviewId);
                                setReviews(await loadAllReviews());
                              }
                            }}
                            style={{
                              background:"transparent", border:`1px solid ${T.border2}`,
                              color:T.muted, borderRadius:5, padding:"6px 12px",
                              fontSize:11.5, cursor:"pointer", fontFamily:T.sans,
                            }}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Info box */}
              <div style={{ marginTop:20, background:T.blueLight, border:`1px solid ${T.blue}20`, borderRadius:8, padding:16 }}>
                <div style={{ fontSize:11.5, color:T.blueDeep, fontWeight:600, marginBottom:6 }}>
                  ¿Para qué sirve este historial?
                </div>
                <div style={{ fontSize:12, color:T.blueMid, lineHeight:1.6 }}>
                  Cada revisión genera una evidencia descargable en formato CSV que documenta qué reglamentos fueron consultados, cuándo, qué cambios se detectaron y qué nivel de impacto tienen. Este registro es válido como evidencia objetiva de vigilancia normativa continua para auditorías internas, revisiones del sistema de gestión y procesos de acreditación ENAC/ISO 17025.
                </div>
              </div>
            </div>
          );
        })()}

      </div>{/* end app-content */}

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop:`1px solid ${T.border}`, background:"white", padding:"12px 28px", marginTop:40, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontSize:11, color:T.muted }}>UNECE Regulatory Monitor</span>
        <span style={{ fontFamily:T.mono, fontSize:10, color:T.dim }}>1958 Agreement · Acuerdo de Ginebra · WP.29</span>
      </footer>
    </div>
  );
}
