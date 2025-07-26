"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCategoryHierarchy = exports.getSubsubcategories = exports.getSubcategories = exports.getAllCategories = exports.validateSubsubcategory = exports.validateSubcategory = exports.validateCategory = exports.VALID_SUBCATEGORIES = exports.VALID_CATEGORIES = void 0;
exports.VALID_CATEGORIES = {
    'Electronics': [
        'CellPhone & Accessories',
        'Computers, Laptop & Tablets',
        'Camera & Accessories'
    ],
    'Vehicles': [
        'Car',
        'Bike',
        'Bicycle',
        'Scooter'
    ],
    'Books': [],
    'Service': [
        'Workout Class',
        'Makeup Class',
        'Yoga Class',
        'Private Tuition'
    ]
};
exports.VALID_SUBCATEGORIES = {
    'CellPhone & Accessories': [
        'Cell Phone',
        'Cell Phone Accessories'
    ],
    'Computers, Laptop & Tablets': [
        'Laptop',
        'Desktop',
        'Tablets',
        'Kindle',
        'Accessories'
    ],
    'Camera & Accessories': [
        'Camera',
        'Lenses',
        'Other Camera & Accessories'
    ],
    'Car': [],
    'Bike': [],
    'Bicycle': [],
    'Scooter': [],
    'Workout Class': [],
    'Makeup Class': [],
    'Yoga Class': [],
    'Private Tuition': []
};
const validateCategory = (category) => {
    return Object.keys(exports.VALID_CATEGORIES).includes(category);
};
exports.validateCategory = validateCategory;
const validateSubcategory = (category, subcategory) => {
    if (!(0, exports.validateCategory)(category)) {
        return false;
    }
    const validSubcategories = exports.VALID_CATEGORIES[category];
    // If category has no subcategories, subcategory should be empty or same as category
    if (validSubcategories.length === 0) {
        return subcategory === '' || subcategory === category;
    }
    return validSubcategories.includes(subcategory);
};
exports.validateSubcategory = validateSubcategory;
const validateSubsubcategory = (subcategory, subsubcategory) => {
    if (!exports.VALID_SUBCATEGORIES[subcategory]) {
        return false;
    }
    const validSubsubcategories = exports.VALID_SUBCATEGORIES[subcategory];
    // If subcategory has no sub-subcategories, subsubcategory should be empty or same as subcategory
    if (validSubsubcategories.length === 0) {
        return subsubcategory === '' || subsubcategory === subcategory;
    }
    return validSubsubcategories.includes(subsubcategory);
};
exports.validateSubsubcategory = validateSubsubcategory;
const getAllCategories = () => {
    return Object.keys(exports.VALID_CATEGORIES);
};
exports.getAllCategories = getAllCategories;
const getSubcategories = (category) => {
    return exports.VALID_CATEGORIES[category] || [];
};
exports.getSubcategories = getSubcategories;
const getSubsubcategories = (subcategory) => {
    return exports.VALID_SUBCATEGORIES[subcategory] || [];
};
exports.getSubsubcategories = getSubsubcategories;
const getCategoryHierarchy = () => {
    const hierarchy = {};
    Object.keys(exports.VALID_CATEGORIES).forEach(category => {
        hierarchy[category] = {};
        const subcategories = exports.VALID_CATEGORIES[category];
        if (subcategories.length === 0) {
            hierarchy[category] = null; // No subcategories
        }
        else {
            subcategories.forEach(subcategory => {
                const subsubcategories = exports.VALID_SUBCATEGORIES[subcategory] || [];
                if (subsubcategories.length === 0) {
                    hierarchy[category][subcategory] = null;
                }
                else {
                    hierarchy[category][subcategory] = subsubcategories;
                }
            });
        }
    });
    return hierarchy;
};
exports.getCategoryHierarchy = getCategoryHierarchy;
//# sourceMappingURL=categories.js.map