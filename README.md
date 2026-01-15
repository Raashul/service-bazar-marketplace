## Introduction
I vibe coded with claude code. Some pieces I wrote by hand in vim (I am learning to write in vim). This is just a simple app I wrote trying to break stuff and have fun while doing it.   

If code is bad blame claude code pls. 

# LLM Marketplace Service

A marketplace backend that actually understands what you're looking for. Search for products using natural language and let the LLM do the heavy lifting.

Think Ebay / fb marketplace meets AI. I say what I want in plain english and it fetches me stuff. If no products, I can say I want xxx and anytime a similar item is added to the system, it sends me an email (tinder matching for marketplace.) 

Natural language parsing.  
AI detection to understand terms and match with keywords.  
Location based query

## Tech Stack

| Layer | Tech |
|-------|------|
| **Runtime** | Node.js + Express |
| **Language** | TypeScript |
| **Database** | PostgreSQL (Supabase) |
| **Hosting** | Render |
| **Storage** | AWS S3 |
| **AI** | OpenAI |
| **Email** | SendGrid |
| **Geocoding** | Mapbox |

## Getting Started

### Run locally
```bash
npm install
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

## API Scripts

Quick scripts to test the API endpoints.

### User Stuff

**Register a user**
```bash
sh scripts/user/register.sh
```

**Login**
```bash
sh scripts/user/login.sh
```

### Products

**Create sample products**

Adds a bunch of test products:
- iPhone 13 Max for $800
- 1BR Apartment in Arlington, VA for $2,000/mo
- Used Vehicle

```bash
sh scripts/product/create-product.sh
```

**Create a service listing**
```bash
sh scripts/product/create-service.sh
```

### Search

**Natural language search**

Search for products the way you'd actually describe them. Be specific with locations (e.g., "Arlington, VA").

```bash
sh scripts/search/search.sh
```

## Infrastructure

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Render    │────▶│  Supabase   │
│             │     │  (Node.js)  │     │ (Postgres)  │
└─────────────┘     └──────┬──────┘     └─────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   External Services   │
              │  OpenAI / S3 / etc.   │
              └───────────────────────┘
```



