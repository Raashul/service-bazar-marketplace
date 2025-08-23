#!/bin/bash

echo "🔍 Product Search Tool"
echo "====================="

read -p "Enter your search query: " query

if [ -z "$query" ]; then
    echo "Error: Search query is required"
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
            echo "⚠️  No location data found, searching without location"
            location_data=""
        fi
    else
        echo "⚠️  Location search failed, searching without location"
        location_data=""
    fi
fi

echo ""
if [ ! -z "$location_data" ]; then
    echo "🔎 Searching for: \"$query\" in location: $selected_location"
else
    echo "🔎 Searching for: \"$query\""
fi

search_response=$(curl -s --location 'http://localhost:3000/api/products/search/natural' \
    --header 'Content-Type: application/json' \
    --data "{
        \"query\": \"$query\",
        \"location_data\": $location_data
    }")

if [ $? -eq 0 ] && [ ! -z "$search_response" ]; then
    echo "✅ Search completed!"
    echo ""
    
    # Get the actual number of products in the array
    actual_products=$(echo "$search_response" | jq -r '.products | length' 2>/dev/null)
    
    if [ "$actual_products" -eq 0 ]; then
        echo "❌ No data available. Try another query."
    else
        echo "📋 Found $actual_products product(s)"
        echo "==========="
        
        # Display each product
        echo "$search_response" | jq -r '.products[] | 
            "
Title: " + .title + "
Description: " + .description + "
Price: $" + .price + " " + .currency + "
Seller: " + .seller_name + "
Email: " + .seller_email + "
Phone: " + .seller_phone + "
---"' 2>/dev/null
    fi
else
    echo "❌ Search failed"
    exit 1
fi