import OpenAI from "openai";
import { SearchMetadata } from "../models/SearchMetadata";
import { VALID_CATEGORIES, VALID_SUBCATEGORIES } from "../utils/categories";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const extractSearchMetadata = async (
  query: string
): Promise<SearchMetadata> => {
  try {
    const prompt = `
You are a metadata extraction system for a marketplace that handles both products and services. Extract relevant search criteria from the natural language query below.

Query: "${query}"

First, determine if this is a PRODUCT search or SERVICE search:
- Product: searching for physical items to buy (iPhone, car, furniture, etc.)
- Service: searching for someone to provide a service (makeup artist, tutor, repair, etc.)

IMPORTANT - Brand/Model Detection:
Determine if the user is searching for a SPECIFIC BRAND or just a generic product type.
- Specific brands: Apple, Samsung, Mercedes, BMW, Toyota, Nike, Sony, Dell, HP, LG, etc.
- Generic searches: "used car", "laptop", "phone", "shoes" (no specific brand)

Extract the following information and return it as a JSON object:
- listing_type: "product" or "service"
- keywords: array of relevant search terms (for generic terms like "car", include synonyms like "vehicle", "automobile")
- brands: array of specific brand names mentioned (e.g., ["Mercedes", "BMW"]). Empty array if no specific brand.
- model: specific model if mentioned (e.g., "iPhone 16 Pro", "C-Class", "Galaxy S24"). null if no specific model.
- is_specific_search: true if user mentioned a specific brand or model, false for generic searches
- min_price: minimum price if specified (number only)
- max_price: maximum price if specified (number only)
- currency: currency code (default to USD if not specified)
- category: general category (Electronics, Services, Clothing, Vehicles, etc.)
- subcategory: more specific category if identifiable
- condition: one of "new", "like_new", "good", "fair", "poor" if mentioned or implied (products only)
- features: array of specific features (for products: storage, color; for services: specializations)
- service_type: type of service needed (only for services)
- availability: time preferences if mentioned (only for services)
- experience_level: skill level required if mentioned (only for services)
- is_negotiable: true if user mentions negotiable/OBO, false if firm price mentioned

Examples:
"Mercedes C-Class" →
{
  "listing_type": "product",
  "keywords": ["Mercedes", "C-Class"],
  "brands": ["Mercedes"],
  "model": "C-Class",
  "is_specific_search": true,
  "category": "Vehicles",
  "subcategory": "Car"
}

"Mercedes or BMW" →
{
  "listing_type": "product",
  "keywords": ["Mercedes", "BMW", "car"],
  "brands": ["Mercedes", "BMW"],
  "model": null,
  "is_specific_search": true,
  "category": "Vehicles",
  "subcategory": "Car"
}

"iPhone 16 Pro" →
{
  "listing_type": "product",
  "keywords": ["iPhone", "iPhone 16", "Apple"],
  "brands": ["Apple"],
  "model": "iPhone 16 Pro",
  "is_specific_search": true,
  "category": "Electronics",
  "subcategory": "CellPhone & Accessories"
}

"used car" →
{
  "listing_type": "product",
  "keywords": ["car", "vehicle", "automobile"],
  "brands": [],
  "model": null,
  "is_specific_search": false,
  "category": "Vehicles",
  "subcategory": "Car",
  "condition": "good"
}

"laptop under $800" →
{
  "listing_type": "product",
  "keywords": ["laptop"],
  "brands": [],
  "model": null,
  "is_specific_search": false,
  "max_price": 800,
  "currency": "USD",
  "category": "Electronics",
  "subcategory": "Computers"
}

"Samsung Galaxy S24" →
{
  "listing_type": "product",
  "keywords": ["Samsung", "Galaxy", "S24"],
  "brands": ["Samsung"],
  "model": "Galaxy S24",
  "is_specific_search": true,
  "category": "Electronics",
  "subcategory": "CellPhone & Accessories"
}

"makeup artist for weddings" →
{
  "listing_type": "service",
  "keywords": ["makeup artist"],
  "brands": [],
  "model": null,
  "is_specific_search": false,
  "category": "Services",
  "subcategory": "Beauty",
  "service_type": "makeup",
  "features": ["weddings", "bridal"]
}

Return only the JSON object, no additional text:`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a precise metadata extraction system for product and service search queries. Do not extract or interpret location information - focus only on product/service details, prices, features, and categories. Always return valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3, // Increased to reduce repetitive outputs
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content?.trim();

    if (!response) {
      throw new Error("No response from LLM");
    }

    // Parse the JSON response
    const metadata: SearchMetadata = JSON.parse(response);

    // Validate and sanitize the response
    return {
      keywords: Array.isArray(metadata.keywords) ? metadata.keywords : [],
      brands: Array.isArray(metadata.brands) ? metadata.brands : [],
      model: typeof metadata.model === "string" ? metadata.model : undefined,
      is_specific_search:
        typeof metadata.is_specific_search === "boolean"
          ? metadata.is_specific_search
          : false,
      listing_type: ["product", "service"].includes(
        metadata.listing_type as string
      )
        ? (metadata.listing_type as any)
        : undefined,
      min_price:
        typeof metadata.min_price === "number" ? metadata.min_price : undefined,
      max_price:
        typeof metadata.max_price === "number" ? metadata.max_price : undefined,
      currency:
        typeof metadata.currency === "string" ? metadata.currency : "USD",
      category:
        typeof metadata.category === "string" ? metadata.category : undefined,
      subcategory:
        typeof metadata.subcategory === "string"
          ? metadata.subcategory
          : undefined,
      subsubcategory:
        typeof metadata.subsubcategory === "string"
          ? metadata.subsubcategory
          : undefined,
      condition: ["new", "like_new", "good", "fair", "poor"].includes(
        metadata.condition as string
      )
        ? (metadata.condition as any)
        : undefined,
      features: Array.isArray(metadata.features) ? metadata.features : [],
      service_type:
        typeof metadata.service_type === "string"
          ? metadata.service_type
          : undefined,
      availability:
        typeof metadata.availability === "string"
          ? metadata.availability
          : undefined,
      experience_level:
        typeof metadata.experience_level === "string"
          ? metadata.experience_level
          : undefined,
      is_negotiable:
        typeof metadata.is_negotiable === "boolean"
          ? metadata.is_negotiable
          : undefined,
    };
  } catch (error) {
    console.error("Error extracting metadata from LLM:", error);

    // Fallback: return basic keyword extraction
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2);
    return {
      keywords: words,
      brands: [],
      model: undefined,
      is_specific_search: false,
      currency: "USD",
    };
  }
};

export const extractEnrichedTags = async (
  title: string,
  description: string,
  price: number
): Promise<string[]> => {
  try {
    const prompt = `
You are a tag extraction system for a marketplace. Extract semantic tags that buyers might search for when looking for this product.

Product Details:
Title: "${title}"
Description: "${description}"
Price: $${price}

Extract tags that represent:
1. Product type and synonyms (e.g., "gaming pc", "desktop computer", "computer build")
2. Key features and capabilities (e.g., "high performance", "gaming", "portable")
3. Brand names and model numbers mentioned
4. Technical specifications that are searchable (e.g., "rtx 3060", "16gb ram", "1tb")
5. Use cases and target audience (e.g., "content creation", "professional", "student")

Return a JSON array of strings. Focus on terms buyers would actually search for.

Examples:
Title: "Custom Built Desktop - RTX 3060, Ryzen 5"
Description: "High performance computer perfect for gaming and streaming"
→ ["gaming pc", "desktop computer", "custom build", "gaming computer", "rtx 3060", "ryzen 5", "high performance", "gaming desktop", "streaming pc", "custom pc"]

Title: "MacBook Pro 13-inch M2"  
Description: "Perfect for students and professionals"
→ ["macbook", "macbook pro", "laptop", "apple laptop", "m2", "student laptop", "professional laptop", "portable computer", "mac"]

Return only the JSON array:`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a precise tag extraction system. Always return valid JSON array only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 300,
    });

    const response = completion.choices[0]?.message?.content?.trim();

    if (!response) {
      throw new Error("No response from LLM");
    }

    // Parse the JSON response
    const tags: string[] = JSON.parse(response);

    // Validate and clean tags
    if (!Array.isArray(tags)) {
      throw new Error("LLM response is not an array");
    }

    return tags
      .filter((tag) => typeof tag === "string" && tag.trim().length > 0)
      .map((tag) => tag.toLowerCase().trim())
      .slice(0, 20); // Limit to 20 tags
  } catch (error) {
    console.error("Error extracting enriched tags from LLM:", error);

    // Fallback: basic tag extraction
    const words = `${title} ${description}`
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2);

    return words.slice(0, 10);
  }
};

export interface BuyerPreferenceMetadata {
  keywords: string[];
  listing_type?: "product" | "service";
  category?: string;
  subcategory?: string;
  subsubcategory?: string;
  min_price?: number;
  max_price?: number;
  currency?: string;
  features?: string[];
}

export const extractBuyerPreferenceMetadata = async (
  preferenceText: string
): Promise<BuyerPreferenceMetadata> => {
  try {
    const validCategories = Object.keys(VALID_CATEGORIES);
    const validSubcategories = Object.keys(VALID_SUBCATEGORIES);

    const prompt = `
You are a metadata extraction system for a marketplace buyer preference. A buyer has described what they want to buy or need as a service. Extract relevant criteria from their preference.

Buyer Preference: "${preferenceText}"

Available Categories: ${validCategories.join(", ")}
Available Subcategories: ${validSubcategories.join(", ")}

Extract the following information and return it as a JSON object:
- listing_type: "product" (physical items to buy such as phones, cars, real-estate) or "service" (someone to provide service like piano teacher, wedding photographer, etc.)
- keywords: array of relevant search terms (5-10 words)
- category: one from available categories if identifiable
- subcategory: one from available subcategories if identifiable  
- subsubcategory: specific sub-sub-category if mentioned
- min_price: minimum price if specified (number only)
- max_price: maximum price if specified (number only)
- currency: currency code (NPR, USD, etc.) if specified
- features: array of specific features or requirements mentioned

Examples:
Input: "Rental house with 2 bed and bath in Bagbazar under $1000 per month"
Output: {"listing_type": "service", "keywords": ["rental", "house", "2 bedroom", "bathroom", "residential"], "category": "RealEstate", "subcategory": "ForRent", "subsubcategory": "House", "max_price": 1000, "currency": "USD", "features": ["2 bedroom", "bathroom"]}

Input: "Need a wedding photographer in Kathmandu for December"
Output: {"listing_type": "service", "keywords": ["wedding", "photographer", "photography"], "category": "Services", "subcategory": "Photography", "features": ["wedding", "december"]}

Input: "Looking for iPhone 15 under 150000 NPR"
Output: {"listing_type": "product", "keywords": ["iphone", "iphone 15", "apple", "smartphone"], "category": "Electronics", "subcategory": "CellPhone & Accessories", "subsubcategory": "Cell Phone", "max_price": 150000, "currency": "NPR", "features": ["iphone 15"]}

Return only valid JSON without additional text.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content?.trim();

    if (!response) {
      throw new Error("No response from LLM");
    }

    // Parse the JSON response
    const metadata: BuyerPreferenceMetadata = JSON.parse(response);

    // Validate and clean the response
    return {
      keywords: Array.isArray(metadata.keywords)
        ? metadata.keywords.slice(0, 10)
        : [],
      listing_type: metadata.listing_type,
      category: metadata.category,
      subcategory: metadata.subcategory,
      subsubcategory: metadata.subsubcategory,
      min_price:
        typeof metadata.min_price === "number" ? metadata.min_price : undefined,
      max_price:
        typeof metadata.max_price === "number" ? metadata.max_price : undefined,
      currency: metadata.currency || "NPR",
      features: Array.isArray(metadata.features) ? metadata.features : [],
    };
  } catch (error) {
    console.error(
      "Error extracting buyer preference metadata from LLM:",
      error
    );

    // Fallback: basic keyword extraction
    const words = preferenceText
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2);

    return {
      keywords: words.slice(0, 5),
      currency: "NPR",
    };
  }
};
