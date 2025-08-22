import { VALID_CATEGORIES, VALID_SUBCATEGORIES } from '../utils/categories';

interface CategoryMapping {
  category?: string;
  subcategory?: string;
  subsubcategory?: string;
}

// Mapping of common search terms to categories
const SEARCH_TERM_MAPPINGS: Record<string, CategoryMapping> = {
  // Electronics
  'phone': { category: 'Electronics', subcategory: 'CellPhone & Accessories' },
  'smartphone': { category: 'Electronics', subcategory: 'CellPhone & Accessories' },
  'cellphone': { category: 'Electronics', subcategory: 'CellPhone & Accessories' },
  'mobile': { category: 'Electronics', subcategory: 'CellPhone & Accessories' },
  'iphone': { category: 'Electronics', subcategory: 'CellPhone & Accessories', subsubcategory: 'Cell Phone' },
  'android': { category: 'Electronics', subcategory: 'CellPhone & Accessories', subsubcategory: 'Cell Phone' },
  'samsung': { category: 'Electronics', subcategory: 'CellPhone & Accessories', subsubcategory: 'Cell Phone' },
  
  'laptop': { category: 'Electronics', subcategory: 'Computers, Laptop & Tablets', subsubcategory: 'Laptop' },
  'computer': { category: 'Electronics', subcategory: 'Computers, Laptop & Tablets' },
  'desktop': { category: 'Electronics', subcategory: 'Computers, Laptop & Tablets', subsubcategory: 'Desktop' },
  'tablet': { category: 'Electronics', subcategory: 'Computers, Laptop & Tablets', subsubcategory: 'Tablets' },
  'ipad': { category: 'Electronics', subcategory: 'Computers, Laptop & Tablets', subsubcategory: 'Tablets' },
  
  'camera': { category: 'Electronics', subcategory: 'Camera & Accessories', subsubcategory: 'Camera' },
  'lens': { category: 'Electronics', subcategory: 'Camera & Accessories', subsubcategory: 'Lenses' },
  'lenses': { category: 'Electronics', subcategory: 'Camera & Accessories', subsubcategory: 'Lenses' },
  
  // Vehicles
  'car': { category: 'Vehicles' },
  'used car': { category: 'Vehicles' },
  'vehicle': { category: 'Vehicles' },
  'automobile': { category: 'Vehicles' },
  'sedan': { category: 'Vehicles' },
  'suv': { category: 'Vehicles' },
  'truck': { category: 'Vehicles' },
  'toyota': { category: 'Vehicles' },
  'honda': { category: 'Vehicles' },
  'ford': { category: 'Vehicles' },
  
  'bike': { category: 'Vehicles', subcategory: 'Bike' },
  'motorcycle': { category: 'Vehicles', subcategory: 'Bike' },
  'motorbike': { category: 'Vehicles', subcategory: 'Bike' },
  
  'bicycle': { category: 'Vehicles', subcategory: 'Bicycle' },
  'cycle': { category: 'Vehicles', subcategory: 'Bicycle' },
  
  'scooter': { category: 'Vehicles', subcategory: 'Scooter' },
  
  // Services
  'workout': { category: 'Services', subcategory: 'Workout' },
  'fitness': { category: 'Services', subcategory: 'Workout' },
  'gym': { category: 'Services', subcategory: 'Workout' },
  'training': { category: 'Services', subcategory: 'Workout' },
  
  'makeup': { category: 'Services', subcategory: 'Makeup' },
  'beauty': { category: 'Services', subcategory: 'Makeup' },
  'cosmetics': { category: 'Services', subcategory: 'Makeup' },
  
  'yoga': { category: 'Services', subcategory: 'Yoga' },
  'meditation': { category: 'Services', subcategory: 'Yoga' },
  
  'photography': { category: 'Services', subcategory: 'Photography' },
  'photographer': { category: 'Services', subcategory: 'Photography' },
  'photoshoot': { category: 'Services', subcategory: 'Photography' },
  
  // Real Estate
  'house': { category: 'RealEstate', subcategory: 'ForSale', subsubcategory: 'House' },
  'home': { category: 'RealEstate', subcategory: 'ForSale', subsubcategory: 'House' },
  'apartment': { category: 'RealEstate', subcategory: 'ForSale', subsubcategory: 'Apartment' },
  'condo': { category: 'RealEstate', subcategory: 'ForSale', subsubcategory: 'Apartment' },
  'land': { category: 'RealEstate', subcategory: 'ForSale', subsubcategory: 'Land' },
  'office': { category: 'RealEstate', subcategory: 'ForSale', subsubcategory: 'Office' },
  
  'rent': { category: 'RealEstate', subcategory: 'ForRent' },
  'rental': { category: 'RealEstate', subcategory: 'ForRent' },
  
  // Books
  'book': { category: 'Books' },
  'books': { category: 'Books' },
  'novel': { category: 'Books' },
  'textbook': { category: 'Books' },
};

/**
 * Maps search query terms to categories using predefined mappings
 */
export function mapQueryToCategories(query: string): CategoryMapping[] {
  const normalizedQuery = query.toLowerCase().trim();
  const words = normalizedQuery.split(/\s+/);
  const mappings: CategoryMapping[] = [];
  
  // Check for exact query match first
  if (SEARCH_TERM_MAPPINGS[normalizedQuery]) {
    mappings.push(SEARCH_TERM_MAPPINGS[normalizedQuery]);
  }
  
  // Check individual words
  words.forEach(word => {
    if (SEARCH_TERM_MAPPINGS[word]) {
      const mapping = SEARCH_TERM_MAPPINGS[word];
      // Avoid duplicates
      if (!mappings.some(m => 
        m.category === mapping.category && 
        m.subcategory === mapping.subcategory &&
        m.subsubcategory === mapping.subsubcategory
      )) {
        mappings.push(mapping);
      }
    }
  });
  
  // Check for partial matches in categories and subcategories
  Object.keys(VALID_CATEGORIES).forEach(category => {
    if (normalizedQuery.includes(category.toLowerCase())) {
      if (!mappings.some(m => m.category === category)) {
        mappings.push({ category });
      }
    }
    
    // Check subcategories
    VALID_CATEGORIES[category].forEach(subcategory => {
      if (normalizedQuery.includes(subcategory.toLowerCase())) {
        if (!mappings.some(m => m.category === category && m.subcategory === subcategory)) {
          mappings.push({ category, subcategory });
        }
      }
      
      // Check sub-subcategories
      const subsubcategories = VALID_SUBCATEGORIES[subcategory] || [];
      subsubcategories.forEach(subsubcategory => {
        if (normalizedQuery.includes(subsubcategory.toLowerCase())) {
          if (!mappings.some(m => 
            m.category === category && 
            m.subcategory === subcategory && 
            m.subsubcategory === subsubcategory
          )) {
            mappings.push({ category, subcategory, subsubcategory });
          }
        }
      });
    });
  });
  
  return mappings;
}

/**
 * Generates SQL conditions for category-based search
 */
export function buildCategorySearchConditions(
  mappings: CategoryMapping[],
  paramCount: number
): { conditions: string[], params: string[], newParamCount: number } {
  
  if (mappings.length === 0) {
    return { conditions: [], params: [], newParamCount: paramCount };
  }
  
  const conditions: string[] = [];
  const params: string[] = [];
  let currentParamCount = paramCount;
  
  mappings.forEach(mapping => {
    const mappingConditions: string[] = [];
    
    if (mapping.category) {
      currentParamCount++;
      mappingConditions.push(`p.category = $${currentParamCount}`);
      params.push(mapping.category);
    }
    
    if (mapping.subcategory) {
      currentParamCount++;
      mappingConditions.push(`p.subcategory = $${currentParamCount}`);
      params.push(mapping.subcategory);
    }
    
    if (mapping.subsubcategory) {
      currentParamCount++;
      mappingConditions.push(`p.subsubcategory = $${currentParamCount}`);
      params.push(mapping.subsubcategory);
    }
    
    if (mappingConditions.length > 0) {
      conditions.push(`(${mappingConditions.join(' AND ')})`);
    }
  });
  
  return {
    conditions,
    params,
    newParamCount: currentParamCount
  };
}