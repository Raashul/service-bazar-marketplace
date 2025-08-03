import OpenAI from 'openai';
import { 
  validateTitle, 
  validateDescription, 
  getCleaningRecommendation, 
  applyAutoFixes,
  ValidationResult,
  CleaningRecommendation
} from '../utils/contentValidation';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface CleaningResult {
  original: {
    title: string;
    description: string;
  };
  cleaned: {
    title: string;
    description: string;
  };
  changes: {
    titleChanged: boolean;
    descriptionChanged: boolean;
    changesApplied: string[];
  };
  method: 'none' | 'auto_fix' | 'llm_cleaned';
  cost_saved: boolean; // true if we avoided LLM call
}

export const cleanProductContent = async (
  title: string, 
  description: string
): Promise<CleaningResult> => {
  
  const result: CleaningResult = {
    original: { title, description },
    cleaned: { title, description }, // Description will remain unchanged
    changes: {
      titleChanged: false,
      descriptionChanged: false, // Will always be false now
      changesApplied: []
    },
    method: 'none',
    cost_saved: true
  };

  // Step 1: Only validate title now (description is preserved as-is)
  const titleValidation = validateTitle(title);
  
  // Step 2: Get cleaning recommendation based only on title
  const recommendation = getTitleCleaningRecommendation(titleValidation);
  
  console.log('Title validation results:', {
    title: titleValidation,
    description: 'Preserved as-is (no cleaning)',
    recommendation
  });

  // Step 3: No issues found
  if (!recommendation.shouldUseLLM && !recommendation.autoFixAvailable) {
    console.log('Title is clean, no changes needed. Description preserved as-is.');
    return result;
  }

  // Step 4: Apply auto-fixes for minor title issues
  if (!recommendation.shouldUseLLM && recommendation.autoFixAvailable) {
    const autoFixedTitle = applyAutoFixes(title);
    
    result.cleaned.title = autoFixedTitle;
    // Description remains unchanged
    result.changes.titleChanged = autoFixedTitle !== title;
    result.method = 'auto_fix';
    
    if (result.changes.titleChanged) {
      result.changes.changesApplied.push('Auto-fixed title punctuation and formatting');
    }
    
    console.log('Applied auto-fixes to title only. Description preserved as-is.');
    return result;
  }

  // Step 5: Use LLM for complex title cleaning only
  if (recommendation.shouldUseLLM) {
    console.log('Using LLM for title cleaning due to:', recommendation.reason);
    
    try {
      const cleanedTitle = await llmCleanTitle(title);
      
      result.cleaned.title = cleanedTitle.title;
      // Description remains unchanged
      result.changes.titleChanged = cleanedTitle.title !== title;
      result.changes.changesApplied = cleanedTitle.changesApplied;
      result.method = 'llm_cleaned';
      result.cost_saved = false;
      
      console.log('LLM title cleaning completed. Description preserved as-is.');
      return result;
      
    } catch (error) {
      console.error('LLM title cleaning failed, falling back to auto-fix:', error);
      
      // Fallback to auto-fix if LLM fails
      const autoFixedTitle = applyAutoFixes(title);
      
      result.cleaned.title = autoFixedTitle;
      // Description remains unchanged
      result.changes.titleChanged = autoFixedTitle !== title;
      result.method = 'auto_fix';
      result.changes.changesApplied.push('LLM failed, applied auto-fixes to title only');
      
      return result;
    }
  }

  return result;
};

// New function to clean titles only
const llmCleanTitle = async (
  title: string
): Promise<{
  title: string;
  changesApplied: string[];
}> => {
  
  const prompt = `
You are a content moderator for a marketplace. Clean up the following product title ONLY by removing inappropriate content while preserving the core product information.

Original Title: "${title}"

Rules for cleaning:
1. Remove phone numbers, email addresses, and contact information
2. Remove redundant price mentions (we have a separate price field)
3. Remove urgency phrases like "need to sell immediately", "must sell today"
4. Remove excessive emojis (keep 1-2 max if relevant)
5. Remove excessive punctuation (!!!, ???, ...)
6. Convert excessive ALL CAPS to normal case (except common acronyms)
7. Remove delivery/pickup details (we have separate fields for this)
8. Keep the product name, brand, model, condition, and technical specifications
9. Make the content professional but friendly
10. Keep titles under 80 characters if possible

Return a JSON object with this exact structure:
{
  "title": "cleaned title here",
  "changesApplied": ["list of changes made"]
}

Example:
Input: "iPhone 15 PRO MAX!!! Best price ever! Must sell TODAY! Call me 555-1234 📱📱📱 $800 non-negotiable!!!"
Output: {
  "title": "iPhone 15 Pro Max",
  "changesApplied": ["Removed phone number", "Removed excessive emojis", "Removed urgency phrases", "Removed price mention", "Cleaned punctuation", "Fixed capitalization"]
}

Return only the JSON object:`;

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You are a professional content moderator. Always return valid JSON only."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.1,
    max_tokens: 300,
  });

  const response = completion.choices[0]?.message?.content?.trim();
  
  if (!response) {
    throw new Error('No response from LLM');
  }

  try {
    const parsed = JSON.parse(response);
    
    return {
      title: typeof parsed.title === 'string' ? parsed.title.trim() : title,
      changesApplied: Array.isArray(parsed.changesApplied) ? parsed.changesApplied : ['Title cleaned']
    };
    
  } catch (error) {
    console.error('Failed to parse LLM response:', response);
    throw new Error('Invalid LLM response format');
  }
};

// New function to get cleaning recommendation based only on title
const getTitleCleaningRecommendation = (
  titleValidation: ValidationResult
): CleaningRecommendation => {
  
  const hasHighSeverity = titleValidation.severity === 'high';
  const hasMediumSeverity = titleValidation.severity === 'medium';
  const hasAnyIssues = titleValidation.needsCleaning;

  // High severity issues = definitely use LLM
  if (hasHighSeverity) {
    return {
      shouldUseLLM: true,
      reason: 'High severity issues detected in title (phone numbers, contact info)',
      autoFixAvailable: false
    };
  }

  // Medium severity with multiple issues = use LLM
  if (hasMediumSeverity && titleValidation.issues.length >= 2) {
    return {
      shouldUseLLM: true,
      reason: 'Multiple medium severity issues detected in title',
      autoFixAvailable: false
    };
  }

  // Minor issues = could auto-fix or skip
  if (hasAnyIssues) {
    return {
      shouldUseLLM: false,
      reason: 'Minor title issues that could be auto-fixed',
      autoFixAvailable: true
    };
  }

  // No issues
  return {
    shouldUseLLM: false,
    reason: 'Title looks clean',
    autoFixAvailable: false
  };
};

// Quick validation check - use this before expensive operations (now only checks title)
export const needsBasicCleaning = (title: string, description: string): boolean => {
  const titleValidation = validateTitle(title);
  // No longer check description - preserve as-is
  
  return titleValidation.needsCleaning;
};

// Get a preview of what would be cleaned (without calling LLM) - now only for titles
export const getCleaningPreview = (title: string, description: string) => {
  const titleValidation = validateTitle(title);
  // No longer validate description - it will be preserved as-is
  const recommendation = getTitleCleaningRecommendation(titleValidation);
  
  return {
    needsCleaning: titleValidation.needsCleaning,
    severity: titleValidation.severity === 'high' ? 3 : titleValidation.severity === 'medium' ? 2 : 1,
    issues: titleValidation.issues,
    recommendation,
    estimatedCost: recommendation.shouldUseLLM ? 0.001 : 0, // rough estimate
    note: 'Description will be preserved exactly as entered (no cleaning applied)'
  };
};