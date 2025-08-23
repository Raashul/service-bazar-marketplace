curl --location 'http://localhost:3000/api/products' \
--header 'Content-Type: application/json' \
--data '{
    "title": "iphone 13 max 256 gb",
    "description": "Iphone 13 Like brand new condition. No any issues. All parts are original. Ime mathcing box. Bh 87%",
    "price": 800,
    "currency": "USD",
    "category": "Electronics",
    "subcategory": "CellPhone & Accessories",
    "condition": "new",
    "location": "Arlington, VA",
    "location_data": {
       "mapbox_id": "dXJuOm1ieHBsYzpGSmlvN0E",
        "full_address": "District of Columbia, United States",
        "latitude": 38.90253,
        "longitude": -77.039386,
        "place_name": "Washington",
        "region": "District of Columbia",
        "country": "United States"
    },
    "listing_type": "product",
    "is_negotiable": true,
    "expires_in_days": 30,
    "seller_id": "bb4c1fb0-57a9-4d75-9112-d5daa3af8c1d"
}' --silent && echo "Successfully created product: iphone 13 max 256 gb"


curl --location 'http://localhost:3000/api/products' \
--header 'Content-Type: application/json' \
--data '{
    "title": "1 Bedroom Apartment for Rent - Arlington, VA",
    "description": "Spacious 1 bedroom apartment available for rent in Arlington, VA for $2,000/month. Conveniently located with easy access to DC metro area. Perfect for professionals or students looking for comfortable living space in a desirable location. Contact for viewing and additional details about amenities, lease terms, and move-in requirements.",
    "price": 2000,
    "currency": "USD",
    "category": "RealEstate",
    "subcategory": "ForRent",
    "condition": "new",
    "location": "Arlington, VA",
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
    "listing_type": "product",
    "is_negotiable": true,
    "expires_in_days": 30,
    "seller_id": "bb4c1fb0-57a9-4d75-9112-d5daa3af8c1d"
}' --silent && echo "Successfully created product: 1 Bedroom Apartment for Rent - Arlington, VA"


curl --location 'http://localhost:3000/api/products' \
--header 'Content-Type: application/json' \
--data '{
    "title": "2015 Toyota corolla S Plus Sedan 4D",
    "description": "Im selling a beautiful Toyota Corolla with only 85 thousand miles everything works perfectly the engine and transmission is impeccable the title is rebuild the price is negotiable only serious buyers thanks I do not accept offers",
    "price": 13000,
    "currency": "USD",
    "category": "Vehicles",
    "subcategory": "",
    "condition": "new",
    "location": "Arlington, VA",
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
    "listing_type": "product",
    "is_negotiable": true,
    "expires_in_days": 30,
    "seller_id": "bb4c1fb0-57a9-4d75-9112-d5daa3af8c1d"
}' --silent && echo "Successfully created product: 2015 Toyota corolla S Plus Sedan 4D"