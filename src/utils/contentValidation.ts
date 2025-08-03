// Basic content validation to detect issues before LLM processing

export interface ValidationResult {
  needsCleaning: boolean;
  issues: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface CleaningRecommendation {
  shouldUseLLM: boolean;
  reason: string;
  autoFixAvailable: boolean;
}

// Phone number patterns
const PHONE_PATTERNS = [
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // 123-456-7890, 123.456.7890, 1234567890
  /\b\(\d{3}\)\s?\d{3}[-.]?\d{4}\b/g, // (123) 456-7890, (123)456-7890
  /\b\d{3}\s\d{3}\s\d{4}\b/g, // 123 456 7890
  /\b\+1\s?\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // +1 123-456-7890
];

// Price patterns (when redundant with the price field)
const PRICE_PATTERNS = [
  /\$\d+(?:,\d{3})*(?:\.\d{2})?/g, // $1,000.00, $500
  /\b\d+(?:,\d{3})*\s?(?:dollars?|usd|bucks?)\b/gi, // 1000 dollars, 500 USD
  /\b(?:price|cost|asking)\s*:?\s*\$?\d+/gi, // price: $500, asking $1000
];

// Urgency/spam phrases
const URGENCY_PHRASES = [
  'need to sell immediately', 'urgent sale', 'must sell today', 'quick sale needed',
  'moving sale', 'need gone asap', 'leaving town', 'need money fast',
  'best price', 'lowest price', 'great deal', 'amazing price', 'cheap price',
  'won\'t find better', 'steal of a deal', 'priced to sell'
];

// Contact info patterns
const CONTACT_PATTERNS = [
  /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, // emails
  /\bwhatsapp\b/gi,
  /\btext me\b/gi,
  /\bcall me\b/gi,
  /\bcontact me\b/gi,
];

// Delivery/pickup phrases
const DELIVERY_PHRASES = [
  'can deliver', 'free delivery', 'will deliver', 'delivery available',
  'pickup only', 'can drop off', 'meet anywhere', 'bring to you'
];

// Emoji detection
const EMOJI_PATTERN = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;

// Excessive punctuation
const EXCESSIVE_PUNCTUATION = /[!]{2,}|[?]{2,}|[.]{3,}/g;

// All caps detection
const ALL_CAPS_WORDS = /\b[A-Z]{3,}\b/g;

export const detectPhoneNumbers = (text: string): string[] => {
  const phones: string[] = [];
  PHONE_PATTERNS.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) phones.push(...matches);
  });
  return phones;
};

export const detectPrices = (text: string): string[] => {
  const prices: string[] = [];
  PRICE_PATTERNS.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) prices.push(...matches);
  });
  return prices;
};

export const detectUrgencyPhrases = (text: string): string[] => {
  const lowerText = text.toLowerCase();
  return URGENCY_PHRASES.filter(phrase => lowerText.includes(phrase));
};

export const detectContactInfo = (text: string): string[] => {
  const contacts: string[] = [];
  CONTACT_PATTERNS.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) contacts.push(...matches);
  });
  return contacts;
};

export const detectDeliveryPhrases = (text: string): string[] => {
  const lowerText = text.toLowerCase();
  return DELIVERY_PHRASES.filter(phrase => lowerText.includes(phrase));
};

export const detectEmojis = (text: string): string[] => {
  return text.match(EMOJI_PATTERN) || [];
};

export const detectExcessivePunctuation = (text: string): string[] => {
  return text.match(EXCESSIVE_PUNCTUATION) || [];
};

export const detectAllCapsWords = (text: string): string[] => {
  return text.match(ALL_CAPS_WORDS) || [];
};

export const validateTitle = (title: string): ValidationResult => {
  const issues: string[] = [];
  let severity: 'low' | 'medium' | 'high' = 'low';

  // Length check
  if (title.length > 100) {
    issues.push('Title too long (over 100 characters)');
    severity = 'medium';
  }

  if (title.length < 5) {
    issues.push('Title too short (under 5 characters)');
    severity = 'medium';
  }

  // Phone numbers in title (high severity)
  const phones = detectPhoneNumbers(title);
  if (phones.length > 0) {
    issues.push(`Phone numbers found: ${phones.join(', ')}`);
    severity = 'high';
  }

  // Prices in title (when we have a separate price field)
  const prices = detectPrices(title);
  if (prices.length > 0) {
    issues.push(`Redundant prices found: ${prices.join(', ')}`);
    severity = 'medium';
  }

  // Contact info
  const contacts = detectContactInfo(title);
  if (contacts.length > 0) {
    issues.push(`Contact info found: ${contacts.join(', ')}`);
    severity = 'high';
  }

  // Urgency phrases
  const urgency = detectUrgencyPhrases(title);
  if (urgency.length > 0) {
    issues.push(`Urgency phrases: ${urgency.join(', ')}`);
    severity = 'medium';
  }

  // Emojis
  const emojis = detectEmojis(title);
  if (emojis.length > 2) {
    issues.push(`Too many emojis: ${emojis.length} found`);
    severity = 'medium';
  }

  // Excessive punctuation
  const punctuation = detectExcessivePunctuation(title);
  if (punctuation.length > 0) {
    issues.push(`Excessive punctuation: ${punctuation.join(', ')}`);
    severity = 'medium';
  }

  // All caps (more than 30% of title)
  const allCaps = detectAllCapsWords(title);
  const totalWords = title.split(/\s+/).length;
  if (allCaps.length > totalWords * 0.3) {
    issues.push(`Too many caps words: ${allCaps.join(', ')}`);
    severity = 'medium';
  }

  return {
    needsCleaning: issues.length > 0,
    issues,
    severity
  };
};

export const validateDescription = (description: string): ValidationResult => {
  const issues: string[] = [];
  let severity: 'low' | 'medium' | 'high' = 'low';

  // Very permissive validation - descriptions are preserved as social media posts
  // Only flag truly problematic content

  // Length check - more generous limit
  if (description.length > 5000) {
    issues.push('Description extremely long (over 5000 characters)');
    severity = 'low'; // Just a warning, not blocking
  }

  // Only flag multiple phone numbers (single phone might be legitimate)
  const phones = detectPhoneNumbers(description);
  if (phones.length > 2) {
    issues.push(`Multiple phone numbers found: ${phones.join(', ')}`);
    severity = 'medium'; // Reduced from high
  }

  // Only flag multiple contact methods
  const contacts = detectContactInfo(description);
  if (contacts.length > 2) {
    issues.push(`Multiple contact methods found: ${contacts.join(', ')}`);
    severity = 'medium'; // Reduced from high
  }

  // Allow price mentions in descriptions (common in social media posts)
  // Only flag excessive price mentions
  const prices = detectPrices(description);
  if (prices.length > 3) {
    issues.push(`Many price mentions: ${prices.join(', ')}`);
    severity = 'low'; // Reduced severity
  }

  // Allow urgency phrases (common in social selling)
  // Only flag excessive urgency
  const urgency = detectUrgencyPhrases(description);
  if (urgency.length > 3) {
    issues.push(`Excessive urgency phrases: ${urgency.join(', ')}`);
    severity = 'low'; // Reduced severity
  }

  // Allow delivery mentions (normal for marketplace listings)
  // Removed delivery phrase checking entirely

  // Allow emojis freely (social media style)
  // Only flag if truly excessive
  const emojis = detectEmojis(description);
  if (emojis.length > 20) {
    issues.push(`Very many emojis: ${emojis.length} found`);
    severity = 'low'; // Just informational
  }

  return {
    needsCleaning: false, // Never recommend cleaning descriptions
    issues: [], // Don't report issues since we preserve descriptions as-is
    severity: 'low' // Always low severity since we don't clean
  };
};

export const getCleaningRecommendation = (
  titleValidation: ValidationResult,
  descValidation: ValidationResult
): CleaningRecommendation => {
  
  const hasHighSeverity = titleValidation.severity === 'high' || descValidation.severity === 'high';
  const hasMediumSeverity = titleValidation.severity === 'medium' || descValidation.severity === 'medium';
  const hasAnyIssues = titleValidation.needsCleaning || descValidation.needsCleaning;

  // High severity issues = definitely use LLM
  if (hasHighSeverity) {
    return {
      shouldUseLLM: true,
      reason: 'High severity issues detected (phone numbers, contact info)',
      autoFixAvailable: false
    };
  }

  // Medium severity with multiple issues = use LLM
  if (hasMediumSeverity && (titleValidation.issues.length + descValidation.issues.length) >= 3) {
    return {
      shouldUseLLM: true,
      reason: 'Multiple medium severity issues detected',
      autoFixAvailable: false
    };
  }

  // Minor issues = could auto-fix or skip
  if (hasAnyIssues) {
    return {
      shouldUseLLM: false,
      reason: 'Minor issues that could be auto-fixed',
      autoFixAvailable: true
    };
  }

  // No issues
  return {
    shouldUseLLM: false,
    reason: 'Content looks clean',
    autoFixAvailable: false
  };
};

// Simple auto-fixes for minor issues
export const applyAutoFixes = (text: string): string => {
  let cleaned = text;

  // Remove excessive punctuation
  cleaned = cleaned.replace(EXCESSIVE_PUNCTUATION, match => {
    if (match.includes('!')) return '!';
    if (match.includes('?')) return '?';
    if (match.includes('.')) return '...';
    return match;
  });

  // Convert excessive caps (but preserve acronyms)
  cleaned = cleaned.replace(/\b[A-Z]{4,}\b/g, match => {
    // Keep common acronyms
    const acronyms = ['HTML', 'JSON', 'HTTP', 'HTTPS', 'USB', 'HDMI', 'WiFi', 'GPS'];
    if (acronyms.includes(match)) return match;
    
    // Convert to title case for long caps
    return match.charAt(0) + match.slice(1).toLowerCase();
  });

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
};