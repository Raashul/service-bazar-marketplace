# API Quick Reference

> Base URL: `http://localhost:3000/api`

## Authentication

| Action | Method | Endpoint | Body |
|--------|--------|----------|------|
| Register | POST | `/auth/register` | `{ phone, name, email, password }` |
| Login | POST | `/auth/login` | `{ email, password }` |
| Refresh | POST | `/auth/refresh` | `{ refreshToken }` |
| Logout | POST | `/auth/logout` | `{ refreshToken }` |

**Tokens:** Access (1h), Refresh (7d)

---

## Products

| Action | Method | Endpoint |
|--------|--------|----------|
| Home (featured + recent) | GET | `/products/home?featured_limit=10&recent_limit=20` |
| List (filtered) | GET | `/products?category=X&min_price=N&status=active` |
| Get one | GET | `/products/:id` |
| Create | POST | `/products` |
| Update | PUT | `/products/:id` |
| Delete | DELETE | `/products/:id` |
| Update status | PUT | `/products/:id/status` |
| Categories | GET | `/products/categories` |
| Natural search | POST | `/products/search/natural` |

**Create Product Body:**
```json
{
  "title": "string",
  "description": "string",
  "price": 100.00,
  "category": "Electronics",
  "subcategory": "CellPhone & Accessories",
  "condition": "good",
  "is_featured": false,
  "location_data": { "latitude": 38.8, "longitude": -77.1, ... }
}
```
*Note: `seller_id` extracted from Authorization token*

**Conditions:** `new`, `like_new`, `good`, `fair`, `poor`

**Status:** `active`, `sold`, `expired`, `removed`

---

## Buyer Preferences

| Action | Method | Endpoint |
|--------|--------|----------|
| List | GET | `/preferences?status=active` |
| Create | POST | `/preferences` |
| Update | PUT | `/preferences/:id` |
| Delete | DELETE | `/preferences/:id` |

**Create Preference Body:**
```json
{
  "preference_text": "Looking for iPhone under $600",
  "location_data": { ... }
}
```

---

## Matches (Recommendations)

| Action | Method | Endpoint |
|--------|--------|----------|
| List all | GET | `/matches?status=new&sort=score` |
| By preference | GET | `/matches/preference/:id` |
| Update status | PUT | `/matches/:id` |
| Statistics | GET | `/matches/stats` |

**Match Status:** `new`, `viewed`, `interested`, `contacted`, `dismissed`

---

## Messages

| Action | Method | Endpoint |
|--------|--------|----------|
| Send (buyer) | POST | `/messages` |
| Seller inbox | GET | `/messages/product/:productId?seller_id=X` |
| Buyer sent | GET | `/messages/buyer/:buyerId` |
| Respond | PUT | `/messages/respond` |

**Send Message Body:**
```json
{
  "product_id": "uuid",
  "buyer_id": "uuid",
  "message": "Is this still available? (10-1000 chars)"
}
```

**Respond Body:**
```json
{
  "message_id": "uuid",
  "seller_id": "uuid",
  "status": "accepted"
}
```

**Message Status:** `pending`, `accepted`, `rejected`

---

## Images

| Action | Method | Endpoint |
|--------|--------|----------|
| Upload single | POST | `/images/upload` (multipart) |
| Upload multiple | POST | `/images/upload-multiple` (multipart) |
| Get for product | GET | `/images/product/:productId` |
| Set preview | PUT | `/images/set-preview` |
| Delete | DELETE | `/images/:imageId` |
| Reorder | PUT | `/images/reorder` |

**Upload Fields:** `image` (file), `product_id` (string)

**Limits:** 5MB max, 10 files max, JPEG/PNG/WebP/GIF

**Note:** Use `signed_url` for display (expires in 1 hour)

---

## Locations

| Action | Method | Endpoint |
|--------|--------|----------|
| Search | GET | `/locations/search?q=Arlington&country=US` |
| Details | GET | `/locations/:mapbox_id` |
| Health | GET | `/locations/health/mapbox` |

**LocationData format (use for products/preferences):**
```json
{
  "mapbox_id": "...",
  "full_address": "Arlington, VA, USA",
  "latitude": 38.8799,
  "longitude": -77.1067,
  "place_name": "Arlington",
  "region": "Virginia",
  "country": "United States"
}
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad request / validation error |
| 401 | Invalid credentials / token |
| 403 | Permission denied |
| 404 | Not found |
| 409 | Conflict / duplicate |
| 503 | External service unavailable |

**Error format:** `{ "error": "message", "details": "..." }`

---

## Common Flows

### Product Listing Flow
```
1. GET /products/categories → Get category options
2. GET /locations/search?q=... → Get location suggestions
3. POST /products → Create listing
4. POST /images/upload-multiple → Add images
5. PUT /images/set-preview → Set main image
```

### Buyer Search Flow
```
1. POST /preferences → Save search preference
2. GET /matches → Get AI recommendations
3. PUT /matches/:id → Mark as viewed/interested
4. POST /messages → Contact seller
```

### Seller Response Flow
```
1. GET /messages/product/:id → See buyer inquiries
2. PUT /messages/respond → Accept or reject
```
