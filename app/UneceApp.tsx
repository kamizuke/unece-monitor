"use client";

import { useState, useEffect } from "react";

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

const DOC_CFG: Record<string, { color: string; bg: string; label: string; short: string; icon: string }> = {
  REVISION:    { color: T.rev,  bg: T.blueFaint, label: "Revisión",    short: "REV", icon: "📘" },
  AMENDMENT:   { color: T.am,   bg: "#faf5ff",   label: "Amendment",   short: "AM",  icon: "📝" },
  SUPPLEMENT:  { color: T.sup,  bg: "#f0f9ff",   label: "Supplement",  short: "SUP", icon: "➕" },
  CORRIGENDUM: { color: T.cor,  bg: "#fff7ed",   label: "Corrigendum", short: "COR", icon: "🔧" },
};

const MOCK_CHANGES = [
  { id:"c1", reg:17,  doc_type:"AMENDMENT",   change_type:"NUEVO_DOCUMENTO", title:"UN R17 Rev.7 — Amendment 2 (11 series)", url:"#", timestamp:"2025-05-07T09:12:00", has_pdf:true, has_prev:true,  summary:"Modifica §5.8.4 — nuevo límite de desplazamiento de apoyacabezas bajo carga dinámica (25 mm). Añade disposiciones transitorias §13.14 hasta 2028." },
  { id:"c2", reg:48,  doc_type:"CORRIGENDUM", change_type:"NUEVO_DOCUMENTO", title:"UN R48 Rev.7 — Corrigendum 1",            url:"#", timestamp:"2025-04-22T08:00:00", has_pdf:true, has_prev:false, summary:"Corrección técnica en Annex 5, tabla de ángulos de inclinación para luces traseras en vehículos N3." },
  { id:"c3", reg:155, doc_type:"AMENDMENT",   change_type:"NUEVO_DOCUMENTO", title:"UN R155 Rev.1 — Amendment 1",             url:"#", timestamp:"2025-02-14T11:30:00", has_pdf:true, has_prev:true,  summary:"Actualización de requisitos CSMS para vehículos conectados. Nuevas categorías de activos de software en Annex 5." },
  { id:"c4", reg:100, doc_type:"REVISION",    change_type:"NUEVO_DOCUMENTO", title:"UN R100 Rev.3 — Consolidated text",       url:"#", timestamp:"2025-01-09T07:45:00", has_pdf:true, has_prev:true,  summary:"Nueva revisión consolidada que incorpora enmiendas 1 y 2 del Rev.2. Cambios significativos en capítulos 6 y 7 sobre baterías de tracción." },
];

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
function fmtDate(ts: string) { return new Date(ts).toLocaleDateString("es-ES", { day:"2-digit", month:"short", year:"numeric" }); }

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

// ── APP ───────────────────────────────────────────────────────────────────────
export default function UneceApp() {
  const [monitored, setMonitored]           = useState(new Set([17, 48, 155, 100]));
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
  }, []);

  async function triggerScraper() {
    setTriggering(true);
    setTriggerMsg(null);
    try {
      const res = await fetch("/api/trigger", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error desconocido");
      setTriggerMsg("✓ Scraping iniciado — los resultados aparecerán en ~2 min");
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

  const now = new Date().toLocaleString("es-ES", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" });

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
      `}</style>

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header style={{ background:T.blueDeep, color:"white", padding:"0 28px", display:"flex", alignItems:"center", gap:0, height:56, flexShrink:0, boxShadow:"0 2px 8px rgba(0,61,107,.25)" }}>
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
            <div style={{ fontSize:10, opacity:.5, letterSpacing:"0.04em" }}>Sistema de vigilancia de reglamentos de homologación</div>
          </div>
        </div>

        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:16 }}>
          {/* Última revisión */}
          <div style={{ textAlign:"right" as const }}>
            <div style={{ fontSize:10, opacity:.5, letterSpacing:"0.04em" }}>ÚLTIMA REVISIÓN</div>
            <div style={{ fontFamily:T.mono, fontSize:11, opacity:.85 }}>
              {lastCheck
                ? new Date(lastCheck).toLocaleString("es-ES", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })
                : "—"}
            </div>
          </div>

          {/* Botón ejecutar scraping */}
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
                <>▶ Ejecutar ahora</>
              )}
            </button>
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
      <div style={{ background:"white", borderBottom:`2px solid ${T.border}`, display:"flex", padding:"0 28px", gap:0 }}>
        {[["dashboard","Dashboard"],["selector",`Reglamentos (${ALL_REGS.length})`],["analysis","Análisis IA"]].map(([id, label]) => (
          <button key={id} onClick={() => setView(id!)} style={{
            padding:"12px 20px", border:"none", background:"transparent", cursor:"pointer",
            fontFamily:T.sans, fontSize:13, fontWeight:600, letterSpacing:"0.02em",
            color: view === id ? T.blueDeep : T.muted,
            borderBottom: `3px solid ${view === id ? T.blue : "transparent"}`,
            marginBottom:-2, transition:"all .15s",
          }}>{label}</button>
        ))}
      </div>

      {/* ── CONTENT ──────────────────────────────────────────────────────── */}
      <div style={{ maxWidth:1200, margin:"0 auto", padding:"24px 28px" }}>

        {/* ════ DASHBOARD ════════════════════════════════════════════════ */}
        {view === "dashboard" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:24, alignItems:"start" }}>
            <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

              {/* Monitored regs grid */}
              <section>
                <h2 style={{ fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.muted, letterSpacing:"0.1em", textTransform:"uppercase" as const, margin:"0 0 12px" }}>
                  Reglamentos monitorizados
                </h2>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))", gap:8 }}>
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
                            : <StatusPill ok={true} label="OK" />}
                        </div>
                        <div style={{ fontSize:11.5, color:T.muted, lineHeight:1.4 }}>{reg?.title}</div>
                        <div style={{ fontSize:10, color:T.dim, marginTop:4, fontFamily:T.mono }}>{reg?.cat}</div>
                      </div>
                    );
                  })}
                  {monitored.size === 0 && (
                    <div style={{ gridColumn:"1/-1", textAlign:"center" as const, padding:40, color:T.muted, background:"white", borderRadius:6, border:`1px dashed ${T.border2}` }}>
                      <div style={{ fontSize:13 }}>Sin reglamentos seleccionados</div>
                      <button onClick={() => setView("selector")} style={{ marginTop:10, background:T.blue, color:"white", border:"none", borderRadius:4, padding:"7px 16px", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                        Añadir reglamentos →
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* Changes feed */}
              <section>
                <h2 style={{ fontFamily:T.sans, fontSize:12, fontWeight:700, color:T.muted, letterSpacing:"0.1em", textTransform:"uppercase" as const, margin:"0 0 12px", display:"flex", alignItems:"center", gap:8 }}>
                  Cambios detectados
                  {monChanges.length > 0 && <span style={{ background:T.cor, color:"white", borderRadius:20, padding:"1px 8px", fontSize:10 }}>{monChanges.length}</span>}
                </h2>

                {loadingData ? (
                  <div style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:6, padding:40, textAlign:"center" as const }}>
                    <div style={{ width:28, height:28, border:`2px solid ${T.blueLight}`, borderTop:`2px solid ${T.blue}`, borderRadius:"50%", margin:"0 auto 12px", animation:"spin 1s linear infinite" }} />
                    <div style={{ fontSize:13, color:T.muted }}>Cargando datos…</div>
                  </div>
                ) : monChanges.length === 0 ? (
                  <div style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:6, padding:40, textAlign:"center" as const }}>
                    <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
                    <div style={{ fontSize:14, color:T.body, fontWeight:500 }}>Todos los reglamentos están actualizados</div>
                    <div style={{ fontSize:12, color:T.muted, marginTop:4 }}>Sin cambios en el período monitorizado</div>
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {monChanges.map(c => {
                      const cfg = DOC_CFG[c.doc_type] || {};
                      return (
                        <div key={c.id} style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:6, overflow:"hidden", display:"flex", boxShadow:"0 1px 3px rgba(0,0,0,.04)", animation:"fadeUp .3s ease" }}>
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
                          </div>
                          <div style={{ display:"flex", alignItems:"center", padding:"0 16px", borderLeft:`1px solid ${T.border}`, background:T.bg }}>
                            <button onClick={() => requestAnalysis(c)} style={{
                              background:T.blue, color:"white", border:"none", borderRadius:5,
                              padding:"9px 16px", fontSize:12, fontWeight:600, cursor:"pointer",
                              fontFamily:T.sans, whiteSpace:"nowrap" as const, letterSpacing:"0.02em",
                            }}>Analizar IA →</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* RIGHT sidebar */}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
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

              <div style={{ background:"white", border:`1px solid ${T.border}`, borderRadius:6, padding:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:T.muted, letterSpacing:"0.08em", textTransform:"uppercase" as const, marginBottom:12 }}>Tipos de documento</div>
                {Object.entries(DOC_CFG).map(([type, cfg]) => (
                  <div key={type} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                    <span style={{ fontSize:14 }}>{cfg.icon}</span>
                    <TypeBadge type={type} />
                    <span style={{ fontSize:11.5, color:T.muted }}>{cfg.label}</span>
                  </div>
                ))}
              </div>

              <div style={{ background:T.blueLight, border:`1px solid ${T.blue}30`, borderRadius:6, padding:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:T.blueDeep, letterSpacing:"0.08em", textTransform:"uppercase" as const, marginBottom:8 }}>Próxima ejecución</div>
                <div style={{ fontFamily:T.mono, fontSize:14, color:T.blueDeep, fontWeight:700 }}>Mañana 09:00 CET</div>
                <div style={{ fontSize:11.5, color:T.blueMid, marginTop:4 }}>GitHub Actions · cron diario automático</div>
              </div>
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
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))", gap:6 }}>
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
      </div>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop:`1px solid ${T.border}`, background:"white", padding:"12px 28px", marginTop:40, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontSize:11, color:T.muted }}>UNECE Regulatory Monitor</span>
        <span style={{ fontFamily:T.mono, fontSize:10, color:T.dim }}>1958 Agreement · Acuerdo de Ginebra · WP.29</span>
      </footer>
    </div>
  );
}
