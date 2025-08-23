#!/bin/bash

echo "📱 Electronic Product Creation Tool"
echo "=================================="

read -p "Enter product title: " title

if [ -z "$title" ]; then
    echo "Error: Product title is required"
    exit 1
fi

read -p "Enter product description: " description

if [ -z "$description" ]; then
    echo "Error: Product description is required"
    exit 1
fi

read -p "Enter product price (USD): " price

if [ -z "$price" ]; then
    echo "Error: Product price is required"
    exit 1
fi

# Validate price is a number
if ! [[ "$price" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
    echo "Error: Price must be a valid number"
    exit 1
fi

read -p "Enter location: " location

if [ -z "$location" ]; then
    echo "Error: Location is required"
    exit 1
fi

location_data=""

if [ ! -z "$location" ]; then
    echo "🌍 Searching for location: $location"
    
    encoded_location=$(echo "$location" | sed 's/ /+/g')
    location_response=$(curl -s --location "http://localhost:3000/api/locations/search?q=${encoded_location}&limit=3")
    
    if [ $? -eq 0 ] && [ ! -z "$location_response" ]; then
        echo "📍 Location found!"
        location_data=$(echo "$location_response" | jq -r '.suggestions[0]' 2>/dev/null)
        
        if [ "$location_data" != "null" ] && [ ! -z "$location_data" ]; then
            selected_location=$(echo "$location_data" | jq -r '.full_address // .place_name // "Unknown"' 2>/dev/null)
            echo "📍 Using location: $selected_location"
        else
            echo "⚠️  No location data found, using provided location"
            location_data="null"
        fi
    else
        echo "⚠️  Location search failed, using provided location"
        location_data="null"
    fi
fi

echo ""
echo "🛍️  Creating electronic product: \"$title\""
echo "💰 Price: \$$price USD"
echo "📍 Location: $location"

create_response=$(curl -s --location 'http://localhost:3000/api/products' \
    --header 'Content-Type: application/json' \
    --data "{
        \"title\": \"$title\",
        \"description\": \"$description\",
        \"price\": $price,
        \"currency\": \"USD\",
        \"category\": \"Electronics\",
        \"subcategory\": \"CellPhone & Accessories\",
        \"condition\": \"new\",
        \"location\": \"$location\",
        \"location_data\": $location_data,
        \"listing_type\": \"product\",
        \"is_negotiable\": true,
        \"expires_in_days\": 30,
        \"seller_id\": \"b212486e-6749-447c-86f6-30c22d2432e1\"
    }")

if [ $? -eq 0 ] && [ ! -z "$create_response" ]; then
    echo "✅ Successfully created electronic product: $title"
else
    echo "❌ Failed to create product"
    exit 1
fi