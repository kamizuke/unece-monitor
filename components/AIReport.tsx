"use client";

import { Bot, Copy, CheckCheck } from "lucide-react";
import { useState } from "react";

interface AIReportProps {
  report: string | null;
  loading: boolean;
  regulationTitle?: string;
}

export default function AIReport({ report, loading, regulationTitle }: AIReportProps) {
  const [copied, setCopied] = useState(false);

  async function copyToClipboard() {
    if (!report) return;
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#b1aba3]">
        <div className="w-10 h-10 border-4 border-[#005b9d] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Consultando Claude AI...</p>
        <p className="text-xs mt-1">Analizando el documento UNECE</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#b1aba3]">
        <Bot size={48} className="mb-3 opacity-30" />
        <p className="text-sm font-medium">Sin análisis generado</p>
        <p className="text-xs mt-1">Pulsa &quot;Analizar IA&quot; en un cambio del Dashboard</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-[#005b9d]" />
          <span className="text-sm font-semibold text-gray-700">
            Análisis IA
            {regulationTitle && (
              <span className="font-normal text-[#b1aba3] ml-2">— {regulationTitle}</span>
            )}
          </span>
        </div>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          {copied ? <CheckCheck size={14} className="text-green-500" /> : <Copy size={14} />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm prose prose-sm max-w-none">
        <MarkdownRenderer content={report} />
      </div>
    </div>
  );
}

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-sm font-bold text-[#003d6b] mt-4 mb-1">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-base font-bold text-[#005b9d] mt-5 mb-2 border-b border-blue-100 pb-1">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-lg font-bold text-[#003d6b] mt-4 mb-3">
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={i} className="ml-4 text-sm text-gray-600 list-disc">
          {line.slice(2)}
        </li>
      );
    } else if (line.startsWith("**") && line.endsWith("**")) {
      elements.push(
        <p key={i} className="text-sm font-bold text-gray-700">
          {line.slice(2, -2)}
        </p>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      const formatted = line
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded font-mono text-xs">$1</code>');
      elements.push(
        <p
          key={i}
          className="text-sm text-gray-600 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: formatted }}
        />
      );
    }
    i++;
  }

  return <>{elements}</>;
}
