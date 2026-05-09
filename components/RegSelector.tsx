"use client";

import { useState } from "react";
import { Search, CheckSquare, Square } from "lucide-react";

const ALL_REGS = [
  { num: 1, name: "Luces de carretera" },
  { num: 3, name: "Dispositivos retroreflectantes" },
  { num: 4, name: "Iluminación placa matrícula" },
  { num: 5, name: "Faros sellados" },
  { num: 6, name: "Intermitentes direccionales" },
  { num: 7, name: "Luces posición/freno" },
  { num: 8, name: "Faros H1/H2/H3" },
  { num: 10, name: "Compatibilidad electromagnética" },
  { num: 11, name: "Cerraduras y bisagras puertas" },
  { num: 12, name: "Columna dirección impacto" },
  { num: 13, name: "Vehículos categoría M/N frenos" },
  { num: 14, name: "Anclajes cinturón seguridad" },
  { num: 16, name: "Cinturones de seguridad" },
  { num: 17, name: "Resistencia asientos" },
  { num: 18, name: "Protección contra robo" },
  { num: 19, name: "Faros antiniebla delanteros" },
  { num: 20, name: "Faros H4" },
  { num: 21, name: "Interior habitáculo impacto" },
  { num: 22, name: "Cascos para motociclistas" },
  { num: 23, name: "Luces marcha atrás" },
  { num: 24, name: "Emisiones diesel" },
  { num: 25, name: "Apoyacabezas" },
  { num: 26, name: "Protuberancias exteriores" },
  { num: 27, name: "Triángulos de advertencia" },
  { num: 28, name: "Bocinas acústicas" },
  { num: 29, name: "Cabinas camiones impacto" },
  { num: 30, name: "Neumáticos turismos" },
  { num: 34, name: "Prevención incendios (depósito)" },
  { num: 35, name: "Pedal freno impacto" },
  { num: 36, name: "Autobuses grandes construcción" },
  { num: 37, name: "Bombillas filamento" },
  { num: 38, name: "Luces antiniebla traseras" },
  { num: 39, name: "Velocímetro" },
  { num: 43, name: "Acristalamientos de seguridad" },
  { num: 44, name: "Sistemas retención infantil" },
  { num: 46, name: "Retrovisores" },
  { num: 48, name: "Instalación alumbrado" },
  { num: 49, name: "Emisiones motores diésel/gas" },
  { num: 51, name: "Ruido vehículos motor" },
  { num: 55, name: "Acoplamientos mecánicos" },
  { num: 58, name: "Protección trasera (PBR)" },
  { num: 66, name: "Resistencia superestructura autobús" },
  { num: 79, name: "Equipo dirección" },
  { num: 83, name: "Emisiones turismos (Euro)" },
  { num: 89, name: "Limitadores velocidad" },
  { num: 100, name: "Vehículos eléctricos/híbridos" },
  { num: 155, name: "Ciberseguridad vehículos" },
  { num: 156, name: "Actualizaciones software OTA" },
  { num: 157, name: "Sistemas conducción autónoma ALKS" },
  { num: 160, name: "Registrador datos eventos (EDR)" },
];

interface RegSelectorProps {
  selected: number[];
  onChange: (regs: number[]) => void;
}

export default function RegSelector({ selected, onChange }: RegSelectorProps) {
  const [query, setQuery] = useState("");

  const filtered = ALL_REGS.filter(
    (r) =>
      r.name.toLowerCase().includes(query.toLowerCase()) ||
      `r${r.num}`.includes(query.toLowerCase()) ||
      String(r.num).includes(query)
  );

  function toggle(num: number) {
    if (selected.includes(num)) {
      onChange(selected.filter((n) => n !== num));
    } else {
      onChange([...selected, num]);
    }
  }

  function selectAll() {
    onChange(filtered.map((r) => r.num));
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b1aba3]" />
          <input
            type="text"
            placeholder="Buscar reglamento..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005b9d] bg-white"
          />
        </div>
        <button
          onClick={selectAll}
          className="text-xs font-medium text-[#005b9d] hover:text-[#003d6b] px-2"
        >
          Todos
        </button>
        <button
          onClick={clearAll}
          className="text-xs font-medium text-gray-400 hover:text-gray-600 px-2"
        >
          Limpiar
        </button>
      </div>

      <p className="text-xs text-[#b1aba3]">
        {selected.length} de {ALL_REGS.length} reglamentos seleccionados para monitorizar
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-1">
        {filtered.map((reg) => {
          const isSelected = selected.includes(reg.num);
          return (
            <button
              key={reg.num}
              onClick={() => toggle(reg.num)}
              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                isSelected
                  ? "border-[#005b9d] bg-blue-50"
                  : "border-gray-100 bg-white hover:border-gray-300"
              }`}
            >
              {isSelected ? (
                <CheckSquare size={16} className="text-[#005b9d] shrink-0" />
              ) : (
                <Square size={16} className="text-gray-300 shrink-0" />
              )}
              <span className="font-mono text-xs font-bold text-[#005b9d] shrink-0 w-8">
                R{reg.num}
              </span>
              <span className="text-xs text-gray-600 truncate">{reg.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
