import { detectGamingCapability, determinePerformanceTier, GAMING_PC_INDICATORS } from '../utils/domainKnowledge';

export interface ListingEnhancementSuggestions {
  suggested_tags: string[];
  suggested_category: string;
  suggested_subcategory?: string;
  performance_tier?: string;
  missing_keywords: string[];
  optimization_tips: string[];
}

export const analyzeListing = (
  title: string, 
  description: string, 
  price: number,
  currentTags: string[] = []
): ListingEnhancementSuggestions => {
  
  const fullText = `${title} ${description}`.toLowerCase();
  const suggestions: ListingEnhancementSuggestions = {
    suggested_tags: [...currentTags],
    suggested_category: 'Electronics',
    missing_keywords: [],
    optimization_tips: []
  };

  // Detect gaming capability
  const isGamingPC = detectGamingCapability(fullText);
  
  if (isGamingPC) {
    suggestions.suggested_category = 'Electronics';
    suggestions.suggested_subcategory = 'Gaming Computers';
    suggestions.performance_tier = determinePerformanceTier(price, fullText);
    
    // Add gaming-specific tags
    const gamingTags = ['gaming', 'pc', 'desktop'];
    gamingTags.forEach(tag => {
      if (!suggestions.suggested_tags.includes(tag)) {
        suggestions.suggested_tags.push(tag);
      }
    });
    
    // Detect specific GPU mentions
    GAMING_PC_INDICATORS.graphics_cards.forEach(gpu => {
      if (fullText.includes(gpu.toLowerCase()) && !suggestions.suggested_tags.includes(gpu)) {
        suggestions.suggested_tags.push(gpu);
      }
    });
    
    // Performance tier tag
    if (suggestions.performance_tier && !suggestions.suggested_tags.includes(suggestions.performance_tier)) {
      suggestions.suggested_tags.push(suggestions.performance_tier.replace('_', ' '));
    }
    
    // Gaming-specific optimization tips
    if (!fullText.includes('gaming')) {
      suggestions.missing_keywords.push('gaming');
      suggestions.optimization_tips.push('Consider adding "gaming" to your title or description for better search visibility');
    }
    
    if (!fullText.includes('fps') && !fullText.includes('performance')) {
      suggestions.missing_keywords.push('performance');
      suggestions.optimization_tips.push('Mention performance capabilities (e.g., "high performance", "60+ FPS") to attract gamers');
    }
    
    // Check for missing specs
    if (!fullText.includes('ram') && !fullText.includes('memory')) {
      suggestions.optimization_tips.push('Include RAM amount (e.g., "16GB RAM") in your description');
    }
    
    if (!fullText.includes('storage') && !fullText.includes('ssd') && !fullText.includes('hdd')) {
      suggestions.optimization_tips.push('Mention storage type and capacity (e.g., "1TB SSD") for better search matching');
    }
    
  } else {
    // General computer detection
    if (fullText.includes('computer') || fullText.includes('pc') || fullText.includes('desktop')) {
      suggestions.suggested_subcategory = 'Computers';
    } else if (fullText.includes('laptop') || fullText.includes('notebook')) {
      suggestions.suggested_subcategory = 'Laptops';
    }
  }

  // Phone detection
  if (fullText.includes('iphone') || fullText.includes('phone') || fullText.includes('smartphone')) {
    suggestions.suggested_category = 'Electronics';
    suggestions.suggested_subcategory = 'Mobile Phones';
    
    if (fullText.includes('iphone')) {
      suggestions.suggested_tags.push('apple', 'ios');
    }
    if (fullText.includes('android')) {
      suggestions.suggested_tags.push('android');
    }
  }

  // Brand detection and tagging
  const brands = ['apple', 'samsung', 'google', 'microsoft', 'dell', 'hp', 'lenovo', 'asus', 'acer'];
  brands.forEach(brand => {
    if (fullText.includes(brand) && !suggestions.suggested_tags.includes(brand)) {
      suggestions.suggested_tags.push(brand);
    }
  });

  // General optimization tips
  if (title.length < 10) {
    suggestions.optimization_tips.push('Consider a more descriptive title (current: ' + title.length + ' characters)');
  }
  
  if (description.length < 50) {
    suggestions.optimization_tips.push('Add more details to your description to improve search visibility');
  }
  
  if (suggestions.suggested_tags.length < 3) {
    suggestions.optimization_tips.push('Add more relevant tags to help buyers find your listing');
  }

  return suggestions;
};

export const enhanceProductListing = (
  title: string,
  description: string, 
  price: number,
  category: string,
  tags: string[]
): {
  enhanced_title: string;
  enhanced_description: string;
  enhanced_tags: string[];
  suggested_category: string;
  suggested_subcategory?: string;
} => {
  
  const suggestions = analyzeListing(title, description, price, tags);
  
  let enhancedTitle = title;
  let enhancedDescription = description;
  
  // Add missing gaming keywords to title if it's a gaming PC
  if (detectGamingCapability(`${title} ${description}`) && !title.toLowerCase().includes('gaming')) {
    enhancedTitle = `Gaming ${title}`;
  }
  
  // Add performance tier to description
  if (suggestions.performance_tier) {
    const tierDescription = suggestions.performance_tier.replace('_', ' ') + ' gaming computer';
    if (!description.toLowerCase().includes(tierDescription)) {
      enhancedDescription += ` Perfect for ${tierDescription} enthusiasts.`;
    }
  }
  
  return {
    enhanced_title: enhancedTitle,
    enhanced_description: enhancedDescription,
    enhanced_tags: suggestions.suggested_tags,
    suggested_category: suggestions.suggested_category,
    suggested_subcategory: suggestions.suggested_subcategory
  };
};