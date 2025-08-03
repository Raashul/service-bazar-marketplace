// Domain-specific knowledge for better search matching

export const GAMING_PC_INDICATORS = {
  graphics_cards: [
    // NVIDIA RTX 40 series
    'rtx 4090', 'rtx 4080', 'rtx 4070', 'rtx 4060',
    // NVIDIA RTX 30 series  
    'rtx 3090', 'rtx 3080', 'rtx 3070', 'rtx 3060',
    // NVIDIA GTX series
    'gtx 1660', 'gtx 1650', 'gtx 1080', 'gtx 1070',
    // AMD RX series
    'rx 7900', 'rx 7800', 'rx 7700', 'rx 6800', 'rx 6700', 'rx 6600', 'rx 6500',
    // Generic terms
    'graphics card', 'gpu', 'video card'
  ],
  
  gaming_keywords: [
    'gaming', 'gamer', 'fps', 'performance', 'high-end', 'enthusiast',
    'streaming', 'content creation', 'workstation', 'custom build',
    'rgb', 'overclocked', 'water cooled'
  ],
  
  performance_tiers: {
    budget: { max_price: 600, keywords: ['budget', 'entry level', 'starter'] },
    mid_range: { max_price: 1200, keywords: ['mid-range', 'mainstream', '1080p'] },
    high_end: { max_price: 2500, keywords: ['high-end', '4k', 'enthusiast', 'flagship'] },
    extreme: { max_price: 999999, keywords: ['extreme', 'workstation', 'professional'] }
  }
};

export const CATEGORY_SYNONYMS = {
  'gaming pc': [
    'gaming computer', 'gaming desktop', 'custom build', 'custom pc',
    'desktop computer', 'workstation', 'gaming rig', 'pc build'
  ],
  
  'laptop': [
    'notebook', 'portable computer', 'gaming laptop', 'ultrabook'
  ],
  
  'phone': [
    'smartphone', 'mobile phone', 'cell phone', 'iphone', 'android'
  ],
  
  'car': [
    'vehicle', 'automobile', 'auto', 'sedan', 'suv', 'truck'
  ]
};

export const BRAND_SYNONYMS = {
  'apple': ['macbook', 'iphone', 'ipad', 'mac'],
  'microsoft': ['surface', 'xbox'],
  'samsung': ['galaxy'],
  'google': ['pixel'],
  'nvidia': ['geforce', 'rtx', 'gtx'],
  'amd': ['radeon', 'ryzen']
};

export const expandSearchTerms = (keywords: string[]): string[] => {
  const expanded = new Set(keywords);
  
  keywords.forEach(keyword => {
    const lowerKeyword = keyword.toLowerCase();
    
    // Add category synonyms
    Object.entries(CATEGORY_SYNONYMS).forEach(([category, synonyms]) => {
      if (lowerKeyword.includes(category)) {
        synonyms.forEach(synonym => expanded.add(synonym));
      }
    });
    
    // Add brand synonyms
    Object.entries(BRAND_SYNONYMS).forEach(([brand, synonyms]) => {
      if (lowerKeyword.includes(brand)) {
        synonyms.forEach(synonym => expanded.add(synonym));
      }
    });
    
    // Add gaming-specific expansions
    if (lowerKeyword.includes('gaming')) {
      GAMING_PC_INDICATORS.gaming_keywords.forEach(term => expanded.add(term));
    }
  });
  
  return Array.from(expanded);
};

export const detectGamingCapability = (text: string): boolean => {
  const lowerText = text.toLowerCase();
  
  // Check for graphics cards
  const hasGamingGPU = GAMING_PC_INDICATORS.graphics_cards.some(gpu => 
    lowerText.includes(gpu.toLowerCase())
  );
  
  // Check for gaming keywords
  const hasGamingKeywords = GAMING_PC_INDICATORS.gaming_keywords.some(keyword =>
    lowerText.includes(keyword.toLowerCase())
  );
  
  return hasGamingGPU || hasGamingKeywords;
};

export const determinePerformanceTier = (price: number, description: string): string => {
  const lowerDesc = description.toLowerCase();
  
  // Check for explicit tier keywords first
  for (const [tier, config] of Object.entries(GAMING_PC_INDICATORS.performance_tiers)) {
    if (config.keywords.some(keyword => lowerDesc.includes(keyword))) {
      return tier;
    }
  }
  
  // Fallback to price-based tiers
  if (price <= 600) return 'budget';
  if (price <= 1200) return 'mid_range';
  if (price <= 2500) return 'high_end';
  return 'extreme';
};