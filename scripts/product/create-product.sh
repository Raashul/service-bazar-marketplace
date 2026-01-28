#!/bin/bash

# Script to create a product and upload images

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="http://localhost:3000/api"

echo "Creating product: 2015 Toyota Camry SE Sport Sedan 4D"

# Create the product and capture the response
RESPONSE=$(curl --location "${BASE_URL}/products" \
--header 'Content-Type: application/json' \
--data '{
    "seller_id": "00000000-0000-0000-0000-000000000001",
    "title": "2015 Toyota camry SE Sport Sedan 4D",
    "description": "rebuilt title! \n91k miles\nadded led headlights\nreplaced front bumper & right side fender \n20% tint all around & sun strip for windshield \nno engine issues \nno leaks\n\nradio needs to be fixed  \ntire pressure sensor needs to be replaced\nfront axle bearing needs to be replaced\n \nText me if interested! looking for real buyers! also looking to sell asap",
    "price": 5000,
    "currency": "USD",
    "category": "Vehicles",
    "subcategory": "Car",
    "subsubcategory": null,
    "condition": "good",
    "is_negotiable": true,
    "listing_type": "product",
    "location_data": {
        "mapbox_id": "dXJuOm1ieHBsYzpxV2pz",
        "full_address": "Arlington, Virginia, United States",
        "latitude": 38.888414,
        "longitude": -77.091601,
        "place_name": "Arlington",
        "district": "Arlington County",
        "region": "Virginia",
        "country": "United States"
    }
}' --silent)

echo "Create product response:"
echo "$RESPONSE" | jq .

# Extract product ID from response
PRODUCT_ID=$(echo "$RESPONSE" | jq -r '.product.id')

if [ "$PRODUCT_ID" == "null" ] || [ -z "$PRODUCT_ID" ]; then
    echo "Error: Failed to create product or extract product ID"
    exit 1
fi

echo ""
echo "Product created with ID: $PRODUCT_ID"
echo ""

# Upload images
echo "Uploading images for product..."

IMAGES_DIR="${SCRIPT_DIR}/images/product1"

if [ ! -d "$IMAGES_DIR" ]; then
    echo "Error: Images directory not found: $IMAGES_DIR"
    exit 1
fi

# Build the curl command with all images
UPLOAD_RESPONSE=$(curl --location "${BASE_URL}/images/upload-multiple" \
    --form "product_id=${PRODUCT_ID}" \
    --form "images=@${IMAGES_DIR}/camry 1.jpg" \
    --form "images=@${IMAGES_DIR}/camry2.jpg" \
    --silent)

echo "Upload images response:"
echo "$UPLOAD_RESPONSE" | jq .

echo ""
echo "Done!"
