import type { Priority } from './types';

/**
 * Baseline complaint classifier (v1).
 *
 * This is a transparent, deterministic keyword/weighted-term model — not a
 * trained neural network. It exists so the product ships with an honest,
 * explainable baseline while labelled data accumulates in `ai_analysis_log`.
 * The schema (predicted category, confidence, accepted_by_user) is designed
 * so a real NLP model can replace this module with no app changes.
 *
 * Model version is reported with every prediction and logged with the
 * complaint, so predictions remain auditable.
 */

export const MODEL_VERSION = 'baseline-keyword-v1';

export interface Suggestion {
  slug: string;
  confidence: number; // 0..1
  analysis: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority: Priority;
}

const CATEGORY_TERMS: Record<string, { strong: string[]; weak: string[] }> = {
  'road-damage': {
    strong: ['pothole', 'pot hole', 'crater', 'sinkhole', 'road collapse', 'broken road'],
    weak: ['road', 'asphalt', 'crack', 'damaged road', 'speed breaker', 'gravel', 'street surface'],
  },
  garbage: {
    strong: ['garbage', 'trash', 'waste', 'rubbish', 'litter', 'overflowing bin', 'dump'],
    weak: ['smell', 'bin', 'collection', 'stink', 'debris pile', 'sweeping'],
  },
  'water-supply': {
    strong: ['water leak', 'pipe burst', 'burst pipe', 'no water', 'water shortage', 'contaminated water'],
    weak: ['water supply', 'tap', 'pipeline', 'low pressure', 'valve', 'borewell', 'tanker'],
  },
  drainage: {
    strong: ['sewage', 'sewer', 'open drain', 'drain overflow', 'stagnant sewage'],
    weak: ['drain', 'gutter', 'waterlogging', 'water logging', 'clogged', 'manhole overflow'],
  },
  streetlights: {
    strong: ['streetlight', 'street light', 'street lamp', 'lamp post broken'],
    weak: ['dark street', 'light not working', 'flickering', 'bulb', 'pole light'],
  },
  electricity: {
    strong: ['exposed wire', 'live wire', 'electrocution', 'hanging cable', 'short circuit', 'transformer'],
    weak: ['electric', 'power cut', 'outage', 'cable', 'pole leaning', 'spark'],
  },
  'public-safety': {
    strong: ['dangerous', 'hazard', 'may fall', 'collapse', 'injury', 'unsafe'],
    weak: ['risk', 'accident waiting', 'sharp object', 'open pit', 'uncovered'],
  },
  sanitation: {
    strong: ['public urination', 'open defecation', 'unclean', 'filthy'],
    weak: ['sanitation', 'hygiene', 'dirty', 'mosquito', 'pest', 'rats'],
  },
  traffic: {
    strong: ['traffic jam', 'blocked road', 'illegal parking', 'signal not working', 'obstruction'],
    weak: ['traffic', 'congestion', 'parked vehicles', 'bottleneck', 'diversion'],
  },
  infrastructure: {
    strong: ['broken bench', 'collapsed footpath', 'damaged bus stop', 'fallen signboard'],
    weak: ['footpath', 'sidewalk', 'signage', 'bench', 'bus stop', 'public property', 'fence', 'monument'],
  },
  other: { strong: [], weak: [] },
};

const URGENT_TERMS = ['danger', 'urgent', 'emergency', 'injury', 'death', 'live wire', 'electrocution', 'collapse', 'drowning', 'fire'];
const HIGH_TERMS = ['accident', 'blocked', 'overflow', 'overflowing', 'sewage', 'heavy', 'deep', 'large', 'children', 'school'];
const LOW_TERMS = ['minor', 'small', 'slight', 'cosmetic', 'fading', 'paint'];

export function classifyDescription(text: string): Suggestion {
  const t = text.toLowerCase();
  let bestSlug = 'other';
  let bestScore = 0;
  let secondScore = 0;
  const matched: string[] = [];

  for (const [slug, terms] of Object.entries(CATEGORY_TERMS)) {
    let score = 0;
    for (const term of terms.strong) {
      if (t.includes(term)) {
        score += 3;
        matched.push(term);
      }
    }
    for (const term of terms.weak) {
      if (t.includes(term)) {
        score += 1;
        matched.push(term);
      }
    }
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestSlug = slug;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  // confidence: margin over runner-up, capped; 'other' stays low-confidence
  const margin = bestScore - secondScore;
  let confidence = bestScore === 0 ? 0 : Math.min(0.92, 0.45 + bestScore * 0.07 + margin * 0.08);
  if (bestSlug === 'other') confidence = 0.15;

  const severity = severityFromText(t, bestSlug);
  const priority = priorityFromText(t, severity);

  const analysis = bestScore === 0
    ? 'No strong category keywords were found in the description; manual selection is recommended.'
    : `Matched civic-issue terms (${matched.slice(0, 4).join(', ')}) suggesting "${bestSlug.replace(/-/g, ' ')}". Visible-severity estimate: ${severity}.`;

  return { slug: bestSlug, confidence, analysis, severity, priority };
}

function severityFromText(t: string, slug: string): Suggestion['severity'] {
  if (URGENT_TERMS.some((w) => t.includes(w))) return 'critical';
  if (HIGH_TERMS.some((w) => t.includes(w))) return 'high';
  if (['electricity', 'drainage'].includes(slug)) return 'high';
  if (LOW_TERMS.some((w) => t.includes(w))) return 'low';
  return 'medium';
}

function priorityFromText(t: string, severity: Suggestion['severity']): Priority {
  if (severity === 'critical' || URGENT_TERMS.some((w) => t.includes(w))) return 'urgent';
  if (severity === 'high') return 'high';
  if (severity === 'low') return 'low';
  return 'medium';
}
