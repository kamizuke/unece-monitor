// ── Types ────────────────────────────────────────────────────────────────────

export interface AccreditationScope {
  id: string;
  fileName: string;
  uploadedAt: string;
  rawText: string;
  pageCount: number;
  extractedReferences: string[];
  testMethods: string[];
  productCategories: string[];
  internalCodes: string[];
}

export interface ScopeMatch {
  isAffected: boolean;
  matchScore: number; // 0–100
  matchedReferences: string[];
  affectedMethods: string[];
  affectedCategories: string[];
  explanation: string;
  recommendedAction: string;
}

// ── Reference extraction ──────────────────────────────────────────────────────

const REF_PATTERNS: RegExp[] = [
  // WP.29 / ECE / UNECE regulation references
  /\bUN\s+Regulation\s+(?:No\.?\s*)?(\d{1,3})\b/gi,
  /\bUNECE\s+R\.?\s*(\d{1,3})\b/gi,
  /\bUN\s+R\.?\s*(\d{1,3})\b/gi,
  /\bR\.?\s*(\d{1,3})\s+(?:of the Agreement|Amendment|Revision|Supplement|Series)\b/gi,
  /\bRegulation\s+(?:No\.?\s*)?(\d{1,3})\b/gi,
  /\bCEPE\/ONU\s+(?:N[º°o]?\.?\s*)?(\d{1,3})\b/gi,          // CEPE/ONU 14  (also covers "Reglamento CEPE/ONU 14")
  /\bECE\s+(?:REGULATION\s+)?N[º°o]?\.?\s*(\d{1,3})\b/gi,   // ECE Nº 10, ECE REGULATION Nº 10
  // ISO / IEC / EN standards
  /\bISO\s+\d[\d\s:\-\.]+/gi,
  /\bIEC\s+\d[\d\s:\-\.]+/gi,
  /\bEN\s+\d[\d\s:\-\.]+/gi,
  /\bCISPR\s+\d[\d\s:\-\.]+/gi,
  /\bFMVSS\s+\d[\d\s:\-\.A-Z]+/gi,
  /\bSAE\s+[A-Z]\d[\d\s:\-\.]+/gi,
  // EU Regulations
  /\bReglamento\s+(?:UE|CE|EU)\s+[\d\/]+/gi,
  /\bEC\s+\d+\/\d+\b/gi,
];

export function extractReferencesFromText(text: string): string[] {
  const found = new Set<string>();
  for (const pattern of REF_PATTERNS) {
    pattern.lastIndex = 0;
    for (const m of text.matchAll(pattern)) {
      found.add(m[0].trim().replace(/\s+/g, " "));
    }
  }
  return Array.from(found);
}

export function extractTestMethods(text: string): string[] {
  const lines = text.split(/\n+/);
  const methods: string[] = [];
  const METHOD_RE = /method|procedure|ensayo|método|procedimiento|test\s+for|prueba\s+de/i;

  for (const line of lines) {
    const l = line.trim();
    if (METHOD_RE.test(l) && l.length > 15 && l.length < 250) {
      methods.push(l.replace(/\s+/g, " "));
    }
  }
  return [...new Set(methods)].slice(0, 60);
}

export function extractProductCategories(text: string): string[] {
  const VEHICLE_KEYWORDS = [
    "passenger car", "M1", "M2", "M3", "N1", "N2", "N3",
    "L1", "L2", "L3", "O1", "O2", "O3", "O4",
    "motorcycle", "truck", "trailer", "bus", "vehicle",
    "automóvil", "vehículo", "motocicleta", "camión", "autobús", "remolque",
    "brake", "lighting", "emission", "noise", "safety",
    "cybersecurity", "electric", "battery", "REESS",
    "freno", "iluminación", "emisión", "ruido", "seguridad",
    "ciberseguridad", "eléctrico", "batería",
  ];
  const lower = text.toLowerCase();
  return VEHICLE_KEYWORDS.filter(kw => lower.includes(kw.toLowerCase()));
}

export function extractInternalCodes(text: string): string[] {
  // Matches patterns like LAB-001, PE-23-001, T-001-A, etc.
  const CODE_RE = /\b[A-Z]{2,6}-\d{2,6}(?:-[A-Z0-9]{1,4})?\b/g;
  const found = new Set<string>();
  for (const m of text.matchAll(CODE_RE)) {
    found.add(m[0]);
  }
  return Array.from(found).slice(0, 30);
}

// ── Regulation number extraction from scope text ──────────────────────────────

function extractRegNums(text: string): Set<number> {
  const nums = new Set<number>();
  const patterns = [
    /\bUN\s+R\.?\s*(\d{1,3})\b/gi,
    /\bUNECE\s+R\.?\s*(\d{1,3})\b/gi,
    /\bUN\s+Regulation\s+(?:No\.?\s*)?(\d{1,3})\b/gi,
    /\bRegulation\s+(?:No\.?\s*)?(\d{1,3})\b/gi,
    /\bCEPE\/ONU\s+(?:N[º°o]?\.?\s*)?(\d{1,3})\b/gi,
    /\bECE\s+(?:REGULATION\s+)?N[º°o]?\.?\s*(\d{1,3})\b/gi,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 200) nums.add(n);
    }
  }
  return nums;
}

// ── Main matcher ─────────────────────────────────────────────────────────────

export function matchChangeAgainstScope(
  change: { reg: number; title: string; summary: string; doc_type?: string },
  scope: AccreditationScope
): ScopeMatch {
  const { reg, title, summary } = change;
  const changeText = `${title} ${summary}`.toLowerCase();
  const scopeText  = scope.rawText;
  const scopeLower = scopeText.toLowerCase();

  const matchedReferences: string[] = [];
  const affectedMethods: string[] = [];
  const affectedCategories: string[] = [];

  // 1. Check if regulation number appears in scope
  const scopeRegNums = extractRegNums(scopeText);
  if (scopeRegNums.has(reg)) {
    matchedReferences.push(`UN R${reg} (número detectado en alcance)`);
  }

  // 2. Check explicit references extracted from scope
  for (const ref of scope.extractedReferences) {
    const nums = ref.match(/\d+/g) || [];
    if (nums.some(n => parseInt(n, 10) === reg)) {
      const label = `${ref} (referencia extraída)`;
      if (!matchedReferences.includes(label)) matchedReferences.push(label);
    }
  }

  // 3. Topic keyword matching between change and scope
  const TOPIC_PAIRS: Array<{ label: string; changeKws: string[]; scopeKws: string[] }> = [
    {
      label: "Ciberseguridad / CSMS",
      changeKws: ["cyber", "csms", "ota", "software update"],
      scopeKws:  ["cyber", "csms", "ota", "software update", "ciberseguridad"],
    },
    {
      label: "Frenado",
      changeKws: ["brake", "braking", "abs", "ebs", "freno"],
      scopeKws:  ["brake", "braking", "abs", "freno"],
    },
    {
      label: "Iluminación",
      changeKws: ["light", "lamp", "headlamp", "photometric"],
      scopeKws:  ["light", "lamp", "headlamp", "iluminación"],
    },
    {
      label: "Emisiones",
      changeKws: ["emission", "exhaust", "co2", "emisión"],
      scopeKws:  ["emission", "emisión", "exhaust"],
    },
    {
      label: "Seguridad pasiva",
      changeKws: ["seat", "belt", "airbag", "restraint", "occupant"],
      scopeKws:  ["seat", "belt", "airbag", "restraint"],
    },
    {
      label: "Vehículos eléctricos",
      changeKws: ["battery", "reess", "electric", "hybrid"],
      scopeKws:  ["battery", "reess", "electric", "híbrido"],
    },
  ];

  for (const pair of TOPIC_PAIRS) {
    const inChange = pair.changeKws.some(kw => changeText.includes(kw));
    const inScope  = pair.scopeKws.some(kw => scopeLower.includes(kw));
    if (inChange && inScope) affectedCategories.push(pair.label);
  }

  // 4. Check test methods mentioning the regulation
  for (const method of scope.testMethods) {
    const mLow = method.toLowerCase();
    if (
      mLow.includes(`r${reg}`) ||
      mLow.includes(`r.${reg}`) ||
      mLow.includes(`regulation ${reg}`) ||
      mLow.includes(`no. ${reg}`) ||
      mLow.includes(`no ${reg}`)
    ) {
      affectedMethods.push(method.substring(0, 120));
    }
  }

  // ── Score & verdict ───────────────────────────────────────────────────────
  const matchScore = Math.min(
    100,
    matchedReferences.length * 40 +
    affectedMethods.length * 15 +
    affectedCategories.length * 10
  );

  const isAffected = matchedReferences.length > 0;

  let explanation: string;
  let recommendedAction: string;

  if (matchedReferences.length > 0 && affectedMethods.length > 0) {
    explanation = `R${reg} está referenciado en el alcance y se detectan métodos posiblemente afectados.`;
    recommendedAction = "Revisar los métodos listados y documentar el análisis de impacto. Evaluar si se requiere actualización del alcance de acreditación.";
  } else if (matchedReferences.length > 0) {
    explanation = `R${reg} aparece referenciado en el alcance acreditado cargado.`;
    recommendedAction = "Verificar si el cambio afecta ensayos cubiertos por la acreditación y documentar el análisis.";
  } else if (affectedCategories.length > 0) {
    explanation = `El cambio aborda temas presentes en el alcance (${affectedCategories.join(", ")}), pero R${reg} no se cita directamente.`;
    recommendedAction = "Revisar si algún ensayo del alcance aplica indirectamente. Sin acción urgente.";
  } else {
    explanation = `No se detecta relación directa entre R${reg} y el alcance acreditado cargado.`;
    recommendedAction = "Sin acción requerida respecto al alcance actual.";
  }

  return {
    isAffected,
    matchScore,
    matchedReferences: matchedReferences.slice(0, 5),
    affectedMethods:   affectedMethods.slice(0, 5),
    affectedCategories,
    explanation,
    recommendedAction,
  };
}
