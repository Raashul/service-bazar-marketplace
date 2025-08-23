curl --location 'http://localhost:3000/api/products' \
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
        "mapbox_id": "dXJuOm1ieHBsYzpxV2pz",
        "full_address": "Virginia, United States",
        "latitude": 38.888414,
        "longitude": -77.091601,
        "place_name": "Arlington",
        "district": "Arlington County",
        "region": "Virginia",
        "country": "United States"
    },
    "listing_type": "service",
    "is_negotiable": false,
    "expires_in_days": 45,
    "seller_id": "bb4c1fb0-57a9-4d75-9112-d5daa3af8c1d"
}' --silent && echo "Successfully created service: Professional Wedding Photography"