export interface CategoryStructure {
    [category: string]: string[];
}
export declare const VALID_CATEGORIES: CategoryStructure;
export declare const VALID_SUBCATEGORIES: CategoryStructure;
export declare const validateCategory: (category: string) => boolean;
export declare const validateSubcategory: (category: string, subcategory: string) => boolean;
export declare const validateSubsubcategory: (subcategory: string, subsubcategory: string) => boolean;
export declare const getAllCategories: () => string[];
export declare const getSubcategories: (category: string) => string[];
export declare const getSubsubcategories: (subcategory: string) => string[];
export declare const getCategoryHierarchy: () => any;
//# sourceMappingURL=categories.d.ts.map