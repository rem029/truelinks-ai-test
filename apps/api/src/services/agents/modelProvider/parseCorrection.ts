export interface ParsedCorrection {
  fieldPath: string;
  value: string | number;
}

type ValueKind = 'money' | 'months' | 'isoDate' | 'name';

interface FieldRule {
  fieldPath: string;
  keywordRegex: RegExp;
  valueKind: ValueKind;
}

// Subjective, ambiguous, or complaint words require asking the user rather than guessing
const VAGUE_WORDS_REGEX =
  /\b(high|low|wrong|bad|cheap|expensive|too\s+much|incorrect|invalid|unclear|missing|increase|decrease|short|long|not\s+paying|unknown)\b/i;

const FIELD_RULES: readonly FieldRule[] = [
  {
    fieldPath: 'rent.amount',
    keywordRegex: /\b(?:set\s+)?(?:monthly\s+)?rent(?:\s+amount)?\b/i,
    valueKind: 'money',
  },
  {
    fieldPath: 'deposit',
    keywordRegex: /\b(?:set\s+)?(?:security\s+)?deposit(?:\s+amount)?\b/i,
    valueKind: 'money',
  },
  {
    fieldPath: 'termMonths',
    keywordRegex: /\b(?:set\s+)?(?:lease\s+)?term(?:\s+months?)?\b/i,
    valueKind: 'months',
  },
  {
    fieldPath: 'commencementDate',
    keywordRegex: /\b(?:set\s+)?(?:start|commencement)(?:\s+date)?\b/i,
    valueKind: 'isoDate',
  },
  {
    fieldPath: 'expiryDate',
    keywordRegex: /\b(?:set\s+)?(?:expiry|end)(?:\s+date)?\b/i,
    valueKind: 'isoDate',
  },
  {
    fieldPath: 'tenant.name',
    keywordRegex: /\b(?:set\s+)?tenant(?:\s*['’]s)?(?:\s+name)?\b/i,
    valueKind: 'name',
  },
  {
    fieldPath: 'landlord.name',
    keywordRegex: /\b(?:set\s+)?landlord(?:\s*['’]s)?(?:\s+name)?\b/i,
    valueKind: 'name',
  },
];

function matchFieldRule(text: string, rule: FieldRule): ParsedCorrection | null {
  const separator = '\\s*(?:is|should\\s+be|to|=|\:)\\s*';
  let valuePattern: string;

  switch (rule.valueKind) {
    case 'money':
      valuePattern = '(?:qar|qr|usd|\\$)?\\s*([0-9][0-9,]*(?:\\.[0-9]+)?)\\b';
      break;
    case 'months':
      valuePattern = '([0-9]+)(?:\\s*months?)?\\b';
      break;
    case 'isoDate':
      // Dates must strictly be ISO YYYY-MM-DD to match schema
      valuePattern = '(\\d{4}-\\d{2}-\\d{2})\\b';
      break;
    case 'name':
      valuePattern = '([A-Za-z0-9][A-Za-z0-9\\s.,\'-]*)';
      break;
  }

  const fullRegex = new RegExp(rule.keywordRegex.source + separator + valuePattern, 'i');
  const match = text.match(fullRegex);
  if (!match || !match[1]) return null;

  const rawVal = match[1];
  switch (rule.valueKind) {
    case 'money': {
      const num = Number(rawVal.replace(/,/g, ''));
      if (isNaN(num)) return null;
      return { fieldPath: rule.fieldPath, value: num };
    }
    case 'months': {
      const num = Number(rawVal);
      if (isNaN(num) || num <= 0) return null;
      return { fieldPath: rule.fieldPath, value: num };
    }
    case 'isoDate':
      return { fieldPath: rule.fieldPath, value: rawVal };
    case 'name': {
      const cleaned = rawVal.replace(/[.,!?;:]+$/, '').trim();
      if (!cleaned || cleaned.length < 2) return null;
      return { fieldPath: rule.fieldPath, value: cleaned };
    }
  }
}

export function parseCorrection(text: string): ParsedCorrection | null {
  if (!text || typeof text !== 'string') return null;
  if (VAGUE_WORDS_REGEX.test(text)) return null;

  const candidates: ParsedCorrection[] = [];
  for (const rule of FIELD_RULES) {
    const candidate = matchFieldRule(text, rule);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  // Any ambiguity (more than one field matched) or unknown input must return null so the agent prompts rather than guesses
  if (candidates.length !== 1 || !candidates[0]) {
    return null;
  }

  return candidates[0];
}
