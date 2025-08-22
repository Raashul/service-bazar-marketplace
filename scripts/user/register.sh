curl --location 'http://localhost:3000/api/auth/register' \
--header 'Content-Type: application/json' \
--data-raw '{
    "phone": "+1234567890",
    "name": "John Doe",
    "email": "john@gmail.com",
    "password": "Password1"
}'