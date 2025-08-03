export interface CategoryStructure {
  [category: string]: string[];
}

export const VALID_CATEGORIES: CategoryStructure = {
  Electronics: [
    "CellPhone & Accessories",
    "Computers, Laptop & Tablets",
    "Camera & Accessories",
  ],
  Vehicles: ["Car", "Bike", "Bicycle", "Scooter"],
  Books: [],
  Services: ["Workout", "Makeup", "Yoga", "Photography"],
  RealEstate: ["ForSale", "ForRent"],
};

export const VALID_SUBCATEGORIES: CategoryStructure = {
  "CellPhone & Accessories": ["Cell Phone", "Cell Phone Accessories"],
  "Computers, Laptop & Tablets": [
    "Laptop",
    "Desktop",
    "Tablets",
    "Kindle",
    "Accessories",
  ],
  "Camera & Accessories": ["Camera", "Lenses", "Other Camera & Accessories"],
  Car: [],
  Bike: [],
  Bicycle: [],
  Scooter: [],
  Workout: [],
  Makeup: [],
  Yoga: [],
  Photography: [],
  ForSale: ["House", "Apartment", "Land", "Office"],
  ForRent: ["House", "Apartment", "Land", "Office"],
};

export const validateCategory = (category: string): boolean => {
  return Object.keys(VALID_CATEGORIES).includes(category);
};

export const validateSubcategory = (
  category: string,
  subcategory: string
): boolean => {
  if (!validateCategory(category)) {
    return false;
  }

  const validSubcategories = VALID_CATEGORIES[category];

  // If category has no subcategories, subcategory should be empty or same as category
  if (validSubcategories.length === 0) {
    return subcategory === "" || subcategory === category;
  }

  return validSubcategories.includes(subcategory);
};

export const validateSubsubcategory = (
  subcategory: string,
  subsubcategory: string
): boolean => {
  if (!VALID_SUBCATEGORIES[subcategory]) {
    return false;
  }

  const validSubsubcategories = VALID_SUBCATEGORIES[subcategory];

  // If subcategory has no sub-subcategories, subsubcategory should be empty or same as subcategory
  if (validSubsubcategories.length === 0) {
    return subsubcategory === "" || subsubcategory === subcategory;
  }

  return validSubsubcategories.includes(subsubcategory);
};

export const getAllCategories = () => {
  return Object.keys(VALID_CATEGORIES);
};

export const getSubcategories = (category: string) => {
  return VALID_CATEGORIES[category] || [];
};

export const getSubsubcategories = (subcategory: string) => {
  return VALID_SUBCATEGORIES[subcategory] || [];
};

export const getCategoryHierarchy = () => {
  const hierarchy: any = {};

  Object.keys(VALID_CATEGORIES).forEach((category) => {
    hierarchy[category] = {};

    const subcategories = VALID_CATEGORIES[category];
    if (subcategories.length === 0) {
      hierarchy[category] = null; // No subcategories
    } else {
      subcategories.forEach((subcategory) => {
        const subsubcategories = VALID_SUBCATEGORIES[subcategory] || [];
        if (subsubcategories.length === 0) {
          hierarchy[category][subcategory] = null;
        } else {
          hierarchy[category][subcategory] = subsubcategories;
        }
      });
    }
  });

  return hierarchy;
};
