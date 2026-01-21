# LLM Marketplace API Specification

> **Document Version:** 1.0
> **Base URL:** `http://localhost:3000/api`
> **Last Updated:** January 2025

This document provides a complete API specification for frontend integration with the LLM Marketplace backend service.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
   - [Health Check](#health-check)
   - [Authentication](#authentication-endpoints)
   - [Products](#products-endpoints)
   - [Buyer Preferences](#buyer-preferences-endpoints)
   - [Matches](#matches-endpoints)
   - [Messages](#messages-endpoints)
   - [Images](#images-endpoints)
   - [Locations](#locations-endpoints)
4. [Data Types & Schemas](#data-types--schemas)
5. [Error Handling](#error-handling)
6. [Category Hierarchy](#category-hierarchy)
7. [Important Notes for Frontend](#important-notes-for-frontend)

---

## Overview

### Tech Stack
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL (Supabase)
- **Storage:** AWS S3 (images)
- **AI/LLM:** OpenAI GPT-3.5 (natural language processing)
- **Location:** Mapbox (geocoding & autocomplete)
- **Email:** SendGrid (notifications)

### Key Features
- Natural language product search with AI-powered metadata extraction
- AI-powered buyer preference matching (Tinder-style)
- Location-based search (3km radius)
- Real-time messaging between buyers and sellers
- Multi-image product uploads with S3 signed URLs

---

## Authentication

### Token Types

| Token | Expiration | Storage Recommendation |
|-------|------------|------------------------|
| Access Token | 1 hour | Memory / sessionStorage |
| Refresh Token | 7 days | httpOnly cookie or secure storage |

### Token Payload (Access Token)
```typescript
{
  sub: string;      // user_id (UUID)
  email: string;
  iat: number;      // issued at
  exp: number;      // expiration
  iss: string;      // issuer
  aud: string;      // audience
}
```

### Authentication Flow

1. **Login** → Receive `accessToken` + `refreshToken`
2. **API Calls** → Include `Authorization: Bearer <accessToken>` header
3. **Token Expired** → Call refresh endpoint with `refreshToken`
4. **Logout** → Call logout endpoint to revoke refresh token

> **Note:** Currently, JWT middleware is not enforced on all routes. The `seller_id` and `buyer_id` are passed in request bodies. This will be updated to extract from JWT claims.

---

## API Endpoints

### Health Check

```
GET /health
```

**Response:**
```json
{
  "status": "OK",
  "message": "Server is running"
}
```

---

### Authentication Endpoints

#### Register User

```
POST /auth/register
Content-Type: application/json
```

**Request Body:**
```typescript
{
  phone: string;     // Required, unique
  name: string;      // Required
  email: string;     // Required, unique, valid email format
  password: string;  // Required
}
```

**Success Response (201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "phone": "+1234567890",
    "name": "John Doe",
    "email": "john@example.com",
    "created_at": "2025-01-20T10:00:00Z"
  }
}
```

**Error Responses:**
| Status | Condition |
|--------|-----------|
| 400 | Missing required fields |
| 409 | Email or phone already exists |
| 500 | Internal server error |

---

#### Login

```
POST /auth/login
Content-Type: application/json
```

**Request Body:**
```typescript
{
  email: string;
  password: string;
}
```

**Success Response (200):**
```json
{
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1...",
  "refreshToken": "eyJhbGciOiJIUzI1...",
  "expiresIn": 3600
}
```

**Error Responses:**
| Status | Condition |
|--------|-----------|
| 400 | Missing email or password |
| 401 | Invalid credentials |
| 500 | Internal server error |

---

#### Refresh Token

```
POST /auth/refresh
Content-Type: application/json
```

**Request Body:**
```typescript
{
  refreshToken: string;
}
```

**Success Response (200):**
```json
{
  "message": "Token refreshed successfully",
  "accessToken": "eyJhbGciOiJIUzI1...",
  "expiresIn": 3600
}
```

**Error Responses:**
| Status | Condition |
|--------|-----------|
| 400 | Missing refresh token |
| 401 | Invalid, expired, or revoked token |
| 500 | Internal server error |

---

#### Logout

```
POST /auth/logout
Content-Type: application/json
```

**Request Body:**
```typescript
{
  refreshToken: string;
}
```

**Success Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

---

### Products Endpoints

#### Get Product Categories

```
GET /products/categories
```

**Success Response (200):**
```json
{
  "message": "Category hierarchy retrieved successfully",
  "categories": {
    "Electronics": {
      "CellPhone & Accessories": ["Cell Phone", "Cell Phone Accessories"],
      "Computers, Laptop & Tablets": ["Laptop", "Desktop", "Tablets", "Kindle", "Accessories"],
      "Camera & Accessories": ["Camera", "Lenses", "Other Camera & Accessories"]
    },
    "Vehicles": {
      "Car": null,
      "Bike": null,
      "Bicycle": null,
      "Scooter": null
    },
    "Books": null,
    "Services": {
      "Workout": null,
      "Makeup": null,
      "Yoga": null,
      "Photography": null
    },
    "RealEstate": {
      "ForSale": ["House", "Apartment", "Land", "Office"],
      "ForRent": ["House", "Apartment", "Land", "Office"]
    }
  }
}
```

---

#### Create Product

```
POST /products
Content-Type: application/json
```

**Request Body:**
```typescript
{
  seller_id: string;              // UUID - Required
  title: string;                  // Required, max 255 chars
  description: string;            // Required
  price: number;                  // Required, decimal
  currency?: string;              // Default: "USD"
  category: string;               // Required - must match hierarchy
  subcategory?: string;
  subsubcategory?: string;
  condition: "new" | "like_new" | "good" | "fair" | "poor";  // Required
  location?: string;              // Legacy field
  location_data?: {               // Structured location from Mapbox
    mapbox_id?: string;
    full_address: string;
    latitude: number;
    longitude: number;
    place_name: string;
    district?: string;
    region: string;
    country: string;
  };
  listing_type?: "product" | "service";  // Default: "product"
  is_negotiable?: boolean;        // Default: true
  expires_in_days?: number;       // Default: 30
}
```

**Success Response (201):**
```json
{
  "message": "Product created successfully",
  "product": {
    "id": "uuid",
    "seller_id": "uuid",
    "title": "iPhone 13 Pro Max",
    "description": "Excellent condition...",
    "price": 799.99,
    "currency": "USD",
    "category": "Electronics",
    "subcategory": "CellPhone & Accessories",
    "subsubcategory": "Cell Phone",
    "condition": "like_new",
    "location": "Arlington, VA",
    "listing_type": "product",
    "enriched_tags": ["iphone", "apple", "smartphone", "128gb", "unlocked"],
    "is_negotiable": true,
    "status": "active",
    "expires_at": "2025-02-19T10:00:00Z",
    "mapbox_id": "...",
    "full_address": "Arlington, VA, USA",
    "latitude": 38.8799,
    "longitude": -77.1067,
    "place_name": "Arlington",
    "region": "Virginia",
    "country": "United States",
    "created_at": "2025-01-20T10:00:00Z",
    "updated_at": "2025-01-20T10:00:00Z"
  },
  "content_cleaning": {
    "title_changes_applied": true,
    "method": "LLM",
    "original_title": "iPhone 13 Pro Max!!!",
    "description_preserved": true,
    "note": "Description preserved with original formatting"
  }
}
```

**Error Responses:**
| Status | Condition |
|--------|-----------|
| 400 | Missing/invalid required fields, invalid category |
| 500 | Internal server error |

---

#### Get All Products (with filters)

```
GET /products?category=Electronics&min_price=500&max_price=1500&condition=good&search=laptop&status=active&page=1&limit=20
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| category | string | - | Filter by category |
| subcategory | string | - | Filter by subcategory |
| subsubcategory | string | - | Filter by subsubcategory |
| min_price | number | - | Minimum price |
| max_price | number | - | Maximum price |
| condition | string | - | Product condition |
| location | string | - | Location (case-insensitive) |
| search | string | - | Search title and description |
| status | string | "active" | "active" \| "sold" \| "expired" |
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |

**Success Response (200):**
```json
{
  "products": [
    {
      "id": "uuid",
      "seller_id": "uuid",
      "title": "MacBook Pro M2",
      "description": "...",
      "price": 1299.99,
      "currency": "USD",
      "category": "Electronics",
      "subcategory": "Computers, Laptop & Tablets",
      "subsubcategory": "Laptop",
      "condition": "good",
      "location": "Arlington, VA",
      "listing_type": "product",
      "enriched_tags": ["macbook", "apple", "m2", "laptop"],
      "is_negotiable": true,
      "status": "active",
      "expires_at": "2025-02-19T10:00:00Z",
      "created_at": "2025-01-20T10:00:00Z",
      "updated_at": "2025-01-20T10:00:00Z",
      "seller_name": "John Doe",
      "seller_phone": "+1234567890",
      "product_images": [
        {
          "id": "uuid",
          "original_filename": "macbook.jpg",
          "signed_url": "https://s3.amazonaws.com/...",
          "display_order": 0,
          "is_preview": true
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

#### Get Single Product

```
GET /products/:id
```

**Success Response (200):**
```json
{
  "product": {
    "id": "uuid",
    "seller_id": "uuid",
    "title": "...",
    "description": "...",
    "price": 799.99,
    "currency": "USD",
    "category": "...",
    "subcategory": "...",
    "subsubcategory": "...",
    "condition": "...",
    "location": "...",
    "listing_type": "product",
    "enriched_tags": [],
    "is_negotiable": true,
    "status": "active",
    "expires_at": "...",
    "mapbox_id": "...",
    "full_address": "...",
    "latitude": 38.8799,
    "longitude": -77.1067,
    "place_name": "...",
    "district": "...",
    "region": "...",
    "country": "...",
    "created_at": "...",
    "updated_at": "...",
    "seller_name": "John Doe",
    "seller_phone": "+1234567890",
    "seller_email": "john@example.com",
    "product_images": []
  }
}
```

**Error Responses:**
| Status | Condition |
|--------|-----------|
| 404 | Product not found |
| 500 | Internal server error |

---

#### Update Product

```
PUT /products/:id
Content-Type: application/json
```

**Request Body:**
```typescript
{
  seller_id: string;              // Required for authorization
  title?: string;
  description?: string;
  price?: number;
  currency?: string;
  category?: string;
  subcategory?: string;
  subsubcategory?: string;
  condition?: string;
  location?: string;
  is_negotiable?: boolean;
  expires_in_days?: number;
}
```

**Success Response (200):**
```json
{
  "message": "Product updated successfully",
  "product": { /* updated product object */ }
}
```

**Error Responses:**
| Status | Condition |
|--------|-----------|
| 400 | Invalid seller_id or no fields to update |
| 403 | Not authorized to update this product |
| 404 | Product not found |
| 500 | Internal server error |

---

#### Delete Product

```
DELETE /products/:id
Content-Type: application/json
```

**Request Body:**
```typescript
{
  seller_id: string;  // UUID - Required for authorization
}
```

**Success Response (200):**
```json
{
  "message": "Product deleted successfully"
}
```

**Error Responses:**
| Status | Condition |
|--------|-----------|
| 400 | Missing seller_id |
| 403 | Not authorized to delete |
| 404 | Product not found |
| 500 | Internal server error |

---

#### Natural Language Search (AI-powered)

```
POST /products/search/natural
Content-Type: application/json
```

**Request Body:**
```typescript
{
  query: string;           // Natural language query
  location_data?: {        // Optional location for proximity search
    mapbox_id?: string;
    full_address: string;
    latitude: number;
    longitude: number;
    place_name: string;
    district?: string;
    region: string;
    country: string;
  };
  limit?: number;          // Default: 20
  page?: number;           // Default: 1
}
```

**Example Queries:**
- "used iPhone 13 under $800 near Arlington, VA"
- "yoga classes in DC area"
- "MacBook Pro good condition less than $1500"

**Success Response (200):**
```json
{
  "products": [ /* array of matching products with images */ ],
  "total": 15,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

**Error Responses:**
| Status | Condition |
|--------|-----------|
| 503 | LLM service unavailable |
| 500 | Internal server error |

---

#### Update Product Status

```
PUT /products/:id/status
Content-Type: application/json
```

**Request Body:**
```typescript
{
  status: "active" | "sold" | "expired" | "removed";
  reason?: string;  // Optional reason for status change
}
```

**Success Response (200):**
```json
{
  "message": "Product status updated successfully",
  "product": {
    "id": "uuid",
    "title": "...",
    "status": "sold",
    "previous_status": "active",
    "updated_at": "2025-01-20T10:00:00Z"
  }
}
```

---

#### Preview Content Cleaning

```
POST /products/preview-cleaning
Content-Type: application/json
```

**Request Body:**
```typescript
{
  title: string;
  description?: string;
}
```

**Success Response (200):**
```json
{
  "preview": {
    "original": "iPhone 13 Pro Max!!! BEST DEAL!!!",
    "cleaned": "iPhone 13 Pro Max",
    "changes_applied": true,
    "note": "Only title will be cleaned. Description preserved exactly as entered."
  },
  "content": {
    "title": "iPhone 13 Pro Max",
    "description_note": "Description will be preserved with original formatting"
  }
}
```

---

#### Generate Enriched Tags

```
POST /products/enrich-tags
Content-Type: application/json
```

**Request Body:**
```typescript
{
  title: string;
  description: string;
  price: number;
}
```

**Success Response (200):**
```json
{
  "enriched_tags": ["iphone", "apple", "smartphone", "pro-max", "128gb"],
  "count": 5
}
```

---

### Buyer Preferences Endpoints

#### Create Buyer Preference

```
POST /preferences
Content-Type: application/json
```

**Request Body:**
```typescript
{
  preference_text: string;    // Natural language preference
  location_data?: {           // Optional location constraint
    mapbox_id?: string;
    full_address: string;
    latitude: number;
    longitude: number;
    place_name: string;
    district?: string;
    region: string;
    country: string;
  };
}
```

**Example preference_text:**
- "I'm looking for a used iPhone 13 or newer under $600"
- "Need a yoga instructor in the DC metro area"
- "Looking for a 2-bedroom apartment for rent under $2000/month"

**Success Response (201):**
```json
{
  "id": "uuid",
  "preference_text": "I'm looking for a used iPhone 13 or newer under $600",
  "extracted_keywords": ["iphone", "13", "used", "smartphone"],
  "extracted_category": "Electronics",
  "extracted_subcategory": "CellPhone & Accessories",
  "extracted_subsubcategory": "Cell Phone",
  "min_price": null,
  "max_price": 600,
  "currency": "USD",
  "listing_type": "product",
  "location_data": { /* location object if provided */ },
  "status": "active",
  "created_at": "2025-01-20T10:00:00Z",
  "updated_at": "2025-01-20T10:00:00Z",
  "match_count": 0
}
```

**Error Responses:**
| Status | Condition |
|--------|-----------|
| 503 | LLM service unavailable |
| 500 | Internal server error |

---

#### Get Buyer Preferences

```
GET /preferences?status=active&limit=20&page=1
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| status | string | - | "active" \| "inactive" \| "paused" |
| limit | number | 20 | Items per page |
| page | number | 1 | Page number |

**Success Response (200):**
```json
{
  "preferences": [
    {
      "id": "uuid",
      "preference_text": "...",
      "extracted_keywords": [],
      "extracted_category": "...",
      "extracted_subcategory": "...",
      "extracted_subsubcategory": "...",
      "min_price": null,
      "max_price": 600,
      "currency": "USD",
      "listing_type": "product",
      "location_data": {},
      "status": "active",
      "created_at": "...",
      "updated_at": "...",
      "match_count": 5
    }
  ],
  "total": 3,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

---

#### Update Buyer Preference

```
PUT /preferences/:id
Content-Type: application/json
```

**Request Body:**
```typescript
{
  preference_text?: string;
  location_data?: { /* location object */ };
  status?: "active" | "inactive" | "paused";
}
```

**Success Response (200):**
```json
{
  "id": "uuid",
  "preference_text": "...",
  /* ... updated preference object */
}
```

---

#### Delete Buyer Preference

```
DELETE /preferences/:id
```

**Success Response (200):**
```json
{
  "message": "Preference deleted successfully"
}
```

---

### Matches Endpoints

#### Get All Matches for Buyer

```
GET /matches?status=new&preference_id=xxx&limit=20&page=1&sort=newest
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| status | string | - | "new" \| "viewed" \| "interested" \| "contacted" \| "dismissed" |
| preference_id | string | - | Filter by specific preference |
| limit | number | 20 | Items per page |
| page | number | 1 | Page number |
| sort | string | "newest" | "newest" \| "oldest" \| "score" |

**Success Response (200):**
```json
{
  "matches": [
    {
      "id": "uuid",
      "preference_id": "uuid",
      "preference_text": "Looking for iPhone under $600",
      "match_score": 85,
      "match_reason": "Product matches price range and category preferences",
      "product_snapshot": {
        "id": "uuid",
        "title": "iPhone 13 128GB",
        "description": "...",
        "price": "550.00",
        "currency": "USD",
        "category": "Electronics",
        "subcategory": "CellPhone & Accessories",
        "subsubcategory": "Cell Phone",
        "condition": "good",
        "location": "Arlington, VA",
        "listing_type": "product",
        "enriched_tags": ["iphone", "apple", "128gb"],
        "is_negotiable": true,
        "status": "active",
        "seller_info": {
          "seller_id": "uuid",
          "seller_name": "Jane Smith",
          "seller_email": "jane@example.com",
          "seller_phone": "+1234567890"
        },
        "location_info": { /* location data */ },
        "created_at": "...",
        "expires_at": "..."
      },
      "status": "new",
      "product_status": "active",
      "matched_at": "2025-01-20T10:00:00Z",
      "viewed_at": null,
      "product_status_updated_at": "2025-01-20T10:00:00Z",
      "is_product_available": true,
      "availability_info": {
        "status": "available",
        "message": "This product is currently available",
        "alternative_actions": []
      }
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 20,
  "totalPages": 1,
  "filters": {
    "status": "new",
    "preference_id": null,
    "sort": "newest"
  }
}
```

---

#### Get Matches for Specific Preference

```
GET /matches/preference/:preference_id?limit=10&page=1
```

**Success Response (200):**
```json
{
  "preference_text": "Looking for iPhone under $600",
  "matches": [ /* array of match objects */ ],
  "total": 5,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

---

#### Update Match Status

```
PUT /matches/:match_id
Content-Type: application/json
```

**Request Body:**
```typescript
{
  status: "viewed" | "interested" | "contacted" | "dismissed";
}
```

**Success Response (200):**
```json
{
  "message": "Match status updated successfully",
  "match": {
    "id": "uuid",
    "status": "interested",
    "viewed_at": "2025-01-20T10:00:00Z",
    "updated_at": "2025-01-20T10:00:00Z"
  }
}
```

---

#### Get Match Statistics

```
GET /matches/stats
```

**Success Response (200):**
```json
{
  "total_matches": 25,
  "by_match_status": {
    "new": 10,
    "viewed": 8,
    "interested": 4,
    "contacted": 2,
    "dismissed": 1
  },
  "by_product_status": {
    "active": 20,
    "sold": 3,
    "expired": 2,
    "removed": 0
  },
  "match_quality": {
    "avg_score": 72.5,
    "best_score": 95
  },
  "recent_activity": {
    "matches_this_week": 8,
    "matches_this_month": 25
  }
}
```

---

### Messages Endpoints

#### Send Initial Message to Seller

```
POST /messages
Content-Type: application/json
```

**Request Body:**
```typescript
{
  product_id: string;   // UUID
  buyer_id: string;     // UUID
  message: string;      // 10-1000 characters
}
```

**Success Response (201):**
```json
{
  "message": "Initial message sent successfully",
  "data": {
    "id": "uuid",
    "product_id": "uuid",
    "buyer_id": "uuid",
    "seller_id": "uuid",
    "message": "Hi, I'm interested in your iPhone...",
    "email_sent": true,
    "email_status": "delivered",
    "created_at": "2025-01-20T10:00:00Z"
  }
}
```

**Error Responses:**
| Status | Condition |
|--------|-----------|
| 400 | Missing fields, message too short/long, self-messaging |
| 404 | Product not found or unavailable |
| 409 | Buyer already sent message for this product |
| 500 | Internal server error |

---

#### Get Messages for Product (Seller View)

```
GET /messages/product/:productId?seller_id=xxx
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| seller_id | string | Yes | UUID of the seller |

**Success Response (200):**
```json
{
  "messages": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "buyer_id": "uuid",
      "seller_id": "uuid",
      "message": "Hi, is this still available?",
      "is_initial_message": true,
      "email_sent": true,
      "status": "pending",
      "responded_at": null,
      "created_at": "2025-01-20T10:00:00Z",
      "buyer_name": "John Doe",
      "buyer_email": "john@example.com",
      "buyer_phone": "+1234567890",
      "product_title": "iPhone 13 Pro"
    }
  ],
  "total": 3
}
```

---

#### Get Messages for Buyer

```
GET /messages/buyer/:buyerId
```

**Success Response (200):**
```json
{
  "messages": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "buyer_id": "uuid",
      "seller_id": "uuid",
      "message": "Hi, is this still available?",
      "is_initial_message": true,
      "email_sent": true,
      "status": "accepted",
      "responded_at": "2025-01-20T11:00:00Z",
      "created_at": "2025-01-20T10:00:00Z",
      "product_title": "iPhone 13 Pro",
      "price": 799.99,
      "currency": "USD",
      "product_status": "active",
      "seller_name": "Jane Smith",
      "seller_email": "jane@example.com",
      "seller_phone": "+1234567890"
    }
  ],
  "total": 5
}
```

---

#### Respond to Message (Seller - Tinder-style)

```
PUT /messages/respond
Content-Type: application/json
```

**Request Body:**
```typescript
{
  message_id: string;   // UUID
  seller_id: string;    // UUID
  status: "accepted" | "rejected";
}
```

**Success Response (200):**
```json
{
  "message": "Message accepted successfully",
  "data": {
    "id": "uuid",
    "product_id": "uuid",
    "buyer_id": "uuid",
    "seller_id": "uuid",
    "status": "accepted",
    "responded_at": "2025-01-20T11:00:00Z",
    "buyer_name": "John Doe",
    "buyer_email": "john@example.com",
    "buyer_phone": "+1234567890",
    "product_title": "iPhone 13 Pro"
  }
}
```

**Error Responses:**
| Status | Condition |
|--------|-----------|
| 400 | Missing/invalid fields |
| 403 | Not authorized to respond |
| 404 | Message not found |
| 409 | Message already responded to |
| 500 | Internal server error |

---

### Images Endpoints

#### Upload Single Image

```
POST /images/upload
Content-Type: multipart/form-data
```

**Form Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| image | File | Yes | Image file |
| product_id | string | Yes | UUID of the product |
| display_order | number | No | Display order (default: 0) |

**Allowed File Types:** JPEG, PNG, WebP, GIF
**Max File Size:** 5MB

**Success Response (201):**
```json
{
  "message": "Image uploaded successfully",
  "image": {
    "id": "uuid",
    "product_id": "uuid",
    "s3_key": "products/uuid/1705743600000_photo.jpg",
    "s3_url": "https://bucket.s3.amazonaws.com/...",
    "original_filename": "photo.jpg",
    "mime_type": "image/jpeg",
    "file_size": 245678,
    "display_order": 0,
    "created_at": "2025-01-20T10:00:00Z",
    "updated_at": "2025-01-20T10:00:00Z",
    "signed_url": "https://bucket.s3.amazonaws.com/...?X-Amz-Signature=..."
  }
}
```

**Error Responses:**
| Status | Condition |
|--------|-----------|
| 400 | No file, invalid product_id, invalid file type |
| 404 | Product not found |
| 503 | S3 service not configured |
| 500 | Internal server error |

---

#### Upload Multiple Images

```
POST /images/upload-multiple
Content-Type: multipart/form-data
```

**Form Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| images | File[] | Yes | Up to 10 image files |
| product_id | string | Yes | UUID of the product |

**Success Response (201):**
```json
{
  "message": "5 images uploaded successfully",
  "images": [ /* array of image objects with signed_url */ ],
  "errors": []
}
```

---

#### Get Images for Product

```
GET /images/product/:productId
```

**Success Response (200):**
```json
{
  "images": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "s3_key": "...",
      "s3_url": "...",
      "original_filename": "photo1.jpg",
      "mime_type": "image/jpeg",
      "file_size": 245678,
      "display_order": 0,
      "created_at": "...",
      "updated_at": "...",
      "signed_url": "https://..."
    }
  ],
  "total": 3
}
```

---

#### Set Preview Image

```
PUT /images/set-preview
Content-Type: application/json
```

**Request Body:**
```typescript
{
  product_id: string;   // UUID
  image_id: string;     // UUID
}
```

**Success Response (200):**
```json
{
  "message": "Preview image set successfully"
}
```

---

#### Delete Image

```
DELETE /images/:imageId
Content-Type: application/json
```

**Request Body:**
```typescript
{
  product_id: string;   // UUID
}
```

**Success Response (200):**
```json
{
  "message": "Image deleted successfully"
}
```

---

#### Reorder Images

```
PUT /images/reorder
Content-Type: application/json
```

**Request Body:**
```typescript
{
  product_id: string;
  image_orders: Array<{
    image_id: string;
    display_order: number;
  }>;
}
```

**Success Response (200):**
```json
{
  "message": "Images reordered successfully"
}
```

---

### Locations Endpoints

#### Location Search (Autocomplete)

```
GET /locations/search?q=Arlington&limit=5&country=US&proximity=-77.1,38.8
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| q | string | Yes | Search query (min 1 char) |
| limit | number | No | Max results (default: 5) |
| country | string | No | 2-letter country code |
| proximity | string | No | "lng,lat" for nearby bias |

**Success Response (200):**
```json
{
  "suggestions": [
    {
      "mapbox_id": "dXJuOm1ieHBsYzpBbTd...",
      "full_address": "Arlington, Virginia, United States",
      "latitude": 38.8799,
      "longitude": -77.1067,
      "place_name": "Arlington",
      "district": "Arlington County",
      "region": "Virginia",
      "country": "United States"
    }
  ],
  "query": "Arlington",
  "attribution": "© Mapbox"
}
```

**Error Responses:**
| Status | Condition |
|--------|-----------|
| 400 | Query missing or too short |
| 429 | Rate limit exceeded |
| 503 | Location service unavailable |
| 500 | Internal server error |

---

#### Get Location Details

```
GET /locations/:mapbox_id
```

**Success Response (200):**
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [-77.1067, 38.8799]
  },
  "properties": { /* Mapbox feature properties */ },
  "location_data": {
    "mapbox_id": "...",
    "full_address": "Arlington, Virginia, United States",
    "latitude": 38.8799,
    "longitude": -77.1067,
    "place_name": "Arlington",
    "district": "Arlington County",
    "region": "Virginia",
    "country": "United States"
  }
}
```

---

#### Mapbox Health Check

```
GET /locations/health/mapbox
```

**Success Response (200):**
```json
{
  "status": "ok",
  "message": "Mapbox API is responding correctly"
}
```

---

## Data Types & Schemas

### User

```typescript
interface User {
  id: string;           // UUID
  phone: string;
  name: string;
  email: string;
  created_at: Date;
  updated_at: Date;
}
```

### Product

```typescript
interface Product {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  subcategory: string | null;
  subsubcategory: string | null;
  condition: "new" | "like_new" | "good" | "fair" | "poor";
  location: string;
  listing_type: "product" | "service";
  enriched_tags: string[];
  is_negotiable: boolean;
  status: "active" | "sold" | "expired" | "removed";
  preview_image_id: string | null;
  expires_at: Date;
  // Mapbox location fields
  mapbox_id: string | null;
  full_address: string | null;
  latitude: number | null;
  longitude: number | null;
  place_name: string | null;
  district: string | null;
  region: string | null;
  country: string | null;
  created_at: Date;
  updated_at: Date;
}
```

### ProductImage

```typescript
interface ProductImage {
  id: string;
  product_id: string;
  s3_key: string;
  s3_url: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  display_order: number;
  created_at: Date;
  updated_at: Date;
  signed_url?: string;    // Included when fetching
  is_preview?: boolean;   // True if this is the preview image
}
```

### BuyerPreference

```typescript
interface BuyerPreference {
  id: string;
  buyer_id: string;
  preference_text: string;
  extracted_keywords: string[];
  extracted_category: string | null;
  extracted_subcategory: string | null;
  extracted_subsubcategory: string | null;
  min_price: number | null;
  max_price: number | null;
  currency: string;
  listing_type: "product" | "service" | null;
  location_data: LocationData | null;
  status: "active" | "inactive" | "paused";
  match_count: number;
  last_matched_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
```

### Match

```typescript
interface Match {
  id: string;
  preference_id: string;
  buyer_id: string;
  product_id: string;
  match_score: number;      // 0-100
  match_reason: string;
  product_snapshot: ProductSnapshot;
  status: "new" | "viewed" | "interested" | "contacted" | "dismissed";
  product_status: "active" | "sold" | "expired" | "removed";
  matched_at: Date;
  viewed_at: Date | null;
  product_status_updated_at: Date;
  updated_at: Date;
}
```

### Message

```typescript
interface Message {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  message: string;
  is_initial_message: boolean;
  email_sent: boolean;
  email_error: string | null;
  email_error_type: string | null;
  status: "pending" | "accepted" | "rejected";
  responded_at: Date | null;
  created_at: Date;
}
```

### LocationData

```typescript
interface LocationData {
  mapbox_id?: string;
  full_address: string;
  latitude: number;
  longitude: number;
  place_name: string;
  district?: string;
  region: string;
  country: string;
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid credentials) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (duplicate resource) |
| 429 | Too Many Requests (rate limited) |
| 503 | Service Unavailable (external service down) |
| 500 | Internal Server Error |

### Error Response Format

```typescript
interface ErrorResponse {
  error: string;
  details?: string;
}
```

**Example:**
```json
{
  "error": "Product not found",
  "details": "No product exists with ID abc123"
}
```

---

## Category Hierarchy

```
Electronics
├── CellPhone & Accessories
│   ├── Cell Phone
│   └── Cell Phone Accessories
├── Computers, Laptop & Tablets
│   ├── Laptop
│   ├── Desktop
│   ├── Tablets
│   ├── Kindle
│   └── Accessories
└── Camera & Accessories
    ├── Camera
    ├── Lenses
    └── Other Camera & Accessories

Vehicles
├── Car
├── Bike
├── Bicycle
└── Scooter

Books (no subcategories)

Services
├── Workout
├── Makeup
├── Yoga
└── Photography

RealEstate
├── ForSale
│   ├── House
│   ├── Apartment
│   ├── Land
│   └── Office
└── ForRent
    ├── House
    ├── Apartment
    ├── Land
    └── Office
```

---

## Important Notes for Frontend

### Image URLs
- All image URLs returned from the API are **signed URLs** valid for **1 hour**
- Refresh image URLs when they expire by re-fetching the product or images endpoint
- Use the `signed_url` field, not `s3_url` for displaying images

### Location Search Flow
1. User types location → Call `GET /locations/search?q=...`
2. Show autocomplete suggestions from `suggestions` array
3. User selects suggestion → Use the `location_data` object directly
4. Pass `location_data` to product creation or preference endpoints

### Natural Language Search
- The backend uses AI to extract search parameters
- Include location_data for proximity-based results (3km radius)
- Gracefully handle 503 errors when LLM service is unavailable

### Tinder-Style Messaging
1. Buyer sends initial message → `POST /messages`
2. Seller sees pending messages → `GET /messages/product/:id`
3. Seller swipes right (accept) or left (reject) → `PUT /messages/respond`
4. Buyer sees response status → `GET /messages/buyer/:id`
5. On acceptance, buyer gets seller contact info

### Match System
- Matches are created automatically when new products match buyer preferences
- Use `GET /matches` to display recommendations
- Update match status as user interacts (viewed → interested → contacted)
- Check `is_product_available` and `product_status` before showing product details

### Current Limitations (Will Be Updated)
1. **Authentication:** `seller_id`/`buyer_id` currently passed in request bodies, will migrate to JWT claims
2. **No rate limiting:** Be mindful of API call frequency
3. **Hardcoded buyer_id:** Preferences/matches use a hardcoded buyer_id (temporary)

### Recommended Client State
- Store access token in memory or sessionStorage
- Store refresh token securely (httpOnly cookie preferred)
- Implement token refresh logic before access token expires
- Cache category hierarchy (rarely changes)
- Implement optimistic updates for status changes

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-20 | Initial API specification |
