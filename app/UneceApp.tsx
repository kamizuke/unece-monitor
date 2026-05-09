"use client";

import { useState, useEffect } from "react";
import { Activity, Settings, Bot, RefreshCw } from "lucide-react";
import Dashboard from "@/components/Dashboard";
import RegSelector from "@/components/RegSelector";
import AIReport from "@/components/AIReport";

interface Change {
  id: string;
  reg: number;
  doc_type: string;
  change_type: string;
  title: string;
  timestamp: string;
  has_pdf: boolean;
  has_prev: boolean;
  summary: string;
}

type View = "dashboard" | "regulations" | "ai";

const NAV_ITEMS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <Activity size={16} /> },
  { id: "regulations", label: "Reglamentos", icon: <Settings size={16} /> },
  { id: "ai", label: "Análisis IA", icon: <Bot size={16} /> },
];

export default function UneceApp() {
  const [view, setView] = useState<View>("dashboard");
  const [changes, setChanges] = useState<Change[]>([]);
  const [selectedRegs, setSelectedRegs] = useState<number[]>([17, 48, 100, 155]);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analyzeTarget, setAnalyzeTarget] = useState<Change | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  useEffect(() => {
    loadChanges();
  }, []);

  async function loadChanges() {
    try {
      const res = await fetch("/changes_log.json?_=" + Date.now());
      const data: Change[] = await res.json();
      setChanges(data);
      if (data.length > 0) {
        const latest = data.reduce((a, b) =>
          new Date(a.timestamp) > new Date(b.timestamp) ? a : b
        );
        setLastUpdate(latest.timestamp);
      }
    } catch {
      setChanges([]);
    }
  }

  async function handleAnalyze(change: Change) {
    setAnalyzingId(change.id);
    setAnalyzeTarget(change);
    setView("ai");
    setAiLoading(true);
    setAiReport(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regulation: `R${change.reg}`,
          docType: change.doc_type,
          title: change.title,
          summary: change.summary,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAiReport(
          `## Error al consultar la IA\n\n${err.error ?? "Error desconocido (status " + res.status + ")"}\n\n> Verifica que ANTHROPIC_API_KEY esté configurada en las variables de entorno de Vercel.`
        );
        return;
      }

      const data = await res.json();
      setAiReport(data.report ?? "Sin respuesta del modelo.");
    } catch (e) {
      setAiReport(
        `## Error de conexión\n\nNo se pudo contactar con la API. Verifica tu conexión y que la variable ANTHROPIC_API_KEY esté configurada.`
      );
    } finally {
      setAiLoading(false);
      setAnalyzingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex flex-col">
      {/* Header */}
      <header className="bg-[#003d6b] text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#005b9d] p-2 rounded-lg">
              <Activity size={20} />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">UNECE Monitor</h1>
              <p className="text-xs text-blue-200 font-mono">WP.29 Regulations Tracker</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-blue-200">
            {lastUpdate && (
              <span className="hidden sm:block">
                Último cambio: {new Date(lastUpdate).toLocaleDateString("es-ES")}
              </span>
            )}
            <button
              onClick={loadChanges}
              className="flex items-center gap-1.5 bg-[#005b9d] hover:bg-[#004a80] px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <RefreshCw size={12} />
              <span>Actualizar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 flex gap-1 py-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === item.id
                  ? "bg-[#005b9d] text-white"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`}
            >
              {item.icon}
              {item.label}
              {item.id === "dashboard" && changes.length > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${view === "dashboard" ? "bg-white text-[#005b9d]" : "bg-[#005b9d] text-white"}`}>
                  {changes.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {view === "dashboard" && (
          <Dashboard
            changes={changes}
            onAnalyze={handleAnalyze}
            analyzing={analyzingId}
          />
        )}
        {view === "regulations" && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-base font-bold text-[#003d6b] mb-4">
              Reglamentos monitorizados
            </h2>
            <RegSelector selected={selectedRegs} onChange={setSelectedRegs} />
          </div>
        )}
        {view === "ai" && (
          <AIReport
            report={aiReport}
            loading={aiLoading}
            regulationTitle={analyzeTarget?.title}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-[#b1aba3] border-t border-gray-100">
        UNECE Monitor · Datos de{" "}
        <a
          href="https://unece.org/transport/vehicle-regulations-wp29/standards/addenda-1958-agreement-regulations-0-20"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#005b9d] hover:underline"
        >
          unece.org
        </a>{" "}
        · Análisis por Claude AI
      </footer>
    </div>
  );
}
