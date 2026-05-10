export type ImpactLevel = "green" | "yellow" | "orange" | "red";

export interface ImpactClassification {
  impactLevel: ImpactLevel;
  impactLabel: string;
  confidence: number;
  reasons: string[];
  affectedTopics: string[];
  recommendedAction: string;
}

// ── Keyword banks ────────────────────────────────────────────────────────────

const RED_KEYWORDS = [
  "shall", "must", "limit", "threshold", "entry into force", "approval",
  "conformity", "requirement", "transitional provisions", "type approval",
  "cybersecurity", "software update", "evidence", "measurement", "tolerance",
  "mandatory", "prohibited", "compliance", "date of application", "obligatory",
  "performance requirement", "maximum", "minimum", "not less than", "not more than",
  "nuevos límites", "límite", "obligatorio", "conformidad", "homologación",
  "entrada en vigor", "requisito obligatorio", "criterio de aceptación",
  "fecha de aplicación", "requisito de conformidad",
];

const ORANGE_KEYWORDS = [
  "test procedure", "procedure", "test method", "measurement method",
  "equipment", "test condition", "operating condition", "calibration",
  "uncertainty", "precision", "accuracy", "sample preparation", "protocol",
  "instrumentation", "test setup", "specimen", "repeatability",
  "procedimiento", "método de ensayo", "equipo", "condiciones de ensayo",
  "calibración", "incertidumbre", "preparación de muestra",
];

const YELLOW_KEYWORDS = [
  "clarification", "note", "informative", "guidance", "recommendation",
  "should", "may", "interpretation", "footnote", "annex", "appendix",
  "explanatory", "editorial note", "informative annex",
  "aclaración", "nota", "orientación", "recomendación", "anejo informativo",
];

const GREEN_KEYWORDS = [
  "renumbered", "editorial", "formatting", "typo", "reference updated",
  "numbering", "punctuation", "spelling", "cross-reference", "reorganized",
  "editorial change", "errata", "corrección editorial", "renumerado",
  "error tipográfico", "referencia actualizada",
];

const TOPIC_MAP: Record<string, string[]> = {
  Ciberseguridad:   ["cyber", "csms", "ota", "software update", "vehicle access"],
  Frenado:          ["brake", "braking", "abs", "ebs", "freno"],
  Iluminación:      ["light", "lamp", "headlamp", "iluminación", "photometric"],
  Emisiones:        ["emission", "exhaust", "co2", "emisión", "pollutant"],
  Ruido:            ["noise", "sound", "acoustic", "ruido", "nvsb"],
  "Software/OTA":   ["software", "ota", "update management", "sums"],
  "Seguridad pasiva":["seat", "belt", "airbag", "restraint", "occupant", "crash"],
  ADAS:             ["autonomous", "alks", "aebs", "lane keeping", "blind spot"],
  EV:               ["battery", "reess", "electric", "hybrid", "charging"],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function matchKeywords(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter(kw => lower.includes(kw.toLowerCase()));
}

// ── Main classifier ──────────────────────────────────────────────────────────

export function classifyRegulatoryChange(
  changeText: string,
  regulationMetadata?: { reg?: number; doc_type?: string; change_type?: string }
): ImpactClassification {
  const docType = (regulationMetadata?.doc_type || "").toUpperCase();
  const fullText = [changeText, docType, regulationMetadata?.change_type || ""].join(" ");

  const redMatches    = matchKeywords(fullText, RED_KEYWORDS);
  const orangeMatches = matchKeywords(fullText, ORANGE_KEYWORDS);
  const yellowMatches = matchKeywords(fullText, YELLOW_KEYWORDS);
  const greenMatches  = matchKeywords(fullText, GREEN_KEYWORDS);

  // Determine level (priority: red > orange > yellow > green)
  let impactLevel: ImpactLevel;
  const reasons: string[] = [];

  if (redMatches.length >= 1) {
    impactLevel = "red";
    reasons.push(...redMatches.slice(0, 3).map(kw => `Término crítico: "${kw}"`));
  } else if (orangeMatches.length >= 1) {
    impactLevel = "orange";
    reasons.push(...orangeMatches.slice(0, 3).map(kw => `Afecta procedimiento: "${kw}"`));
    // AMENDMENT/REVISION without red terms defaults to orange
    if (docType === "AMENDMENT" || docType === "REVISION") {
      reasons.push(`Tipo de documento: ${docType}`);
    }
  } else if (yellowMatches.length >= 1) {
    impactLevel = "yellow";
    reasons.push(...yellowMatches.slice(0, 3).map(kw => `Cambio interpretativo: "${kw}"`));
  } else if (greenMatches.length >= 1) {
    impactLevel = "green";
    reasons.push(...greenMatches.slice(0, 3).map(kw => `Cambio editorial: "${kw}"`));
  } else {
    // Fallback based on doc type
    if (docType === "CORRIGENDUM") { impactLevel = "green"; reasons.push("Corrigendum: corrección típicamente editorial."); }
    else if (docType === "SUPPLEMENT") { impactLevel = "yellow"; reasons.push("Suplemento: puede incluir aclaraciones."); }
    else if (docType === "AMENDMENT") { impactLevel = "orange"; reasons.push("Amendment: modificación técnica probable."); }
    else if (docType === "REVISION") { impactLevel = "red"; reasons.push("Revisión completa del reglamento."); }
    else { impactLevel = "yellow"; reasons.push("Clasificación por defecto: revisar manualmente."); }
  }

  // CORRIGENDUM override: cap at yellow unless explicit red keyword
  if (docType === "CORRIGENDUM" && impactLevel === "orange" && redMatches.length === 0) {
    impactLevel = "yellow";
  }

  // Detect affected topics from change text
  const affectedTopics: string[] = [];
  const lower = fullText.toLowerCase();
  for (const [topic, kws] of Object.entries(TOPIC_MAP)) {
    if (kws.some(kw => lower.includes(kw))) affectedTopics.push(topic);
  }

  // Confidence: ratio of top-matched bucket vs total text signals
  const allMatches = redMatches.length + orangeMatches.length + yellowMatches.length + greenMatches.length;
  const topMatches = { red: redMatches.length, orange: orangeMatches.length, yellow: yellowMatches.length, green: greenMatches.length }[impactLevel];
  const confidence = allMatches === 0 ? 0.45 : Math.min(0.95, 0.5 + (topMatches / (allMatches + 1)) * 0.5);

  const LABELS: Record<ImpactLevel, string> = {
    green:  "Informativo",
    yellow: "Revisar",
    orange: "Afecta método",
    red:    "Crítico",
  };

  const ACTIONS: Record<ImpactLevel, string> = {
    green:  "Sin acción requerida. Registrar como cambio informativo.",
    yellow: "Revisar el texto completo y evaluar si afecta procedimientos internos.",
    orange: "Revisar procedimientos de ensayo y documentación técnica afectada.",
    red:    "Acción urgente: revisar procedimientos internos y documentar análisis de impacto sobre métodos acreditados.",
  };

  return {
    impactLevel,
    impactLabel: LABELS[impactLevel],
    confidence,
    reasons,
    affectedTopics,
    recommendedAction: ACTIONS[impactLevel],
  };
}
