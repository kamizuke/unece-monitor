"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  ChevronRight,
  Activity,
  Shield,
} from "lucide-react";

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

interface DashboardProps {
  changes: Change[];
  onAnalyze: (change: Change) => void;
  analyzing: string | null;
}

const DOC_TYPE_COLORS: Record<string, string> = {
  AMENDMENT: "bg-blue-100 text-blue-800",
  CORRIGENDUM: "bg-amber-100 text-amber-800",
  SUPPLEMENT: "bg-green-100 text-green-800",
  REVISION: "bg-purple-100 text-purple-800",
  ADDENDUM: "bg-rose-100 text-rose-800",
};

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function Dashboard({ changes, onAnalyze, analyzing }: DashboardProps) {
  const total = changes.length;
  const withPdf = changes.filter((c) => c.has_pdf).length;
  const regsAffected = new Set(changes.map((c) => c.reg)).size;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Activity size={20} className="text-white" />}
          label="Cambios detectados"
          value={total}
          color="bg-[#005b9d]"
        />
        <StatCard
          icon={<Shield size={20} className="text-white" />}
          label="Reglamentos afectados"
          value={regsAffected}
          color="bg-[#003d6b]"
        />
        <StatCard
          icon={<FileText size={20} className="text-white" />}
          label="Con PDF disponible"
          value={withPdf}
          color="bg-slate-600"
        />
      </div>

      {/* Changes list */}
      {changes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#b1aba3]">
          <CheckCircle size={48} className="mb-3 opacity-40" />
          <p className="text-lg font-medium">Sin cambios detectados</p>
          <p className="text-sm mt-1">La próxima revisión de reglamentos es a las 07:00 UTC</p>
        </div>
      ) : (
        <div className="space-y-3">
          {changes.map((change) => (
            <ChangeCard
              key={change.id}
              change={change}
              onAnalyze={onAnalyze}
              isAnalyzing={analyzing === change.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 shadow-sm">
      <div className={`${color} rounded-lg p-2.5`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        <p className="text-xs text-[#b1aba3] mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function ChangeCard({
  change,
  onAnalyze,
  isAnalyzing,
}: {
  change: Change;
  onAnalyze: (c: Change) => void;
  isAnalyzing: boolean;
}) {
  const typeColor =
    DOC_TYPE_COLORS[change.doc_type] ?? "bg-gray-100 text-gray-700";

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-mono text-xs font-bold bg-[#005b9d] text-white px-2 py-0.5 rounded">
              R{change.reg}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColor}`}>
              {change.doc_type}
            </span>
            {change.has_pdf && (
              <span className="text-xs text-green-600 flex items-center gap-0.5">
                <Download size={11} /> PDF
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-800 truncate">{change.title}</p>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{change.summary}</p>
          <div className="flex items-center gap-1 mt-2 text-xs text-[#b1aba3]">
            <Clock size={11} />
            {formatDate(change.timestamp)}
          </div>
        </div>
        <button
          onClick={() => onAnalyze(change)}
          disabled={isAnalyzing}
          className="shrink-0 flex items-center gap-1.5 text-xs font-medium bg-[#005b9d] hover:bg-[#003d6b] disabled:bg-[#b1aba3] text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          {isAnalyzing ? (
            <>
              <span className="animate-spin">⟳</span> Analizando...
            </>
          ) : (
            <>
              Analizar IA <ChevronRight size={12} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
