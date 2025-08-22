curl --location 'http://localhost:3001/api/products' \
--header 'Content-Type: application/json' \
--data '{
    "title": "Professional Wedding Photography",
    "description": "Experienced wedding photographer with 5+ years expertise. Capture your special moments with artistic flair! 📸✨\n\n• Full day coverage\n• High-resolution photos\n• Quick turnaround\n• Drone shots available",
    "price": 1000,
    "currency": "USD",
    "category": "Services",
    "condition": "new",
    "subcategory": "Photography",
    "location": "Patan, Lalitpur",
    "location_data": {
        "mapbox_id": "dXJuOm1ieHBsYzo2eWlx",
        "full_address": "Patan, Lalitpur, Bagmati Province, Nepal",
        "latitude": 27.6766,
        "longitude": 85.3250,
        "place_name": "Patan",
        "district": "Lalitpur",
        "region": "Bagmati Province",
        "country": "Nepal"
    },
    "listing_type": "service",
    "is_negotiable": false,
    "expires_in_days": 45,
    "seller_id": "81a561ef-6ffd-4939-8fa8-55eedae0b047"
}'