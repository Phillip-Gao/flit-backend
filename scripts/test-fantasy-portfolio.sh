#!/bin/bash

# Test Fantasy Portfolio API Endpoints

BASE_URL="http://localhost:3000/api"

echo "🧪 Testing Fantasy Portfolio API"
echo "=================================="
echo ""

# 1. Get all portfolios for current user (phillipgao)
echo "1️⃣ Getting all portfolios..."
curl -s "${BASE_URL}/fantasy-portfolio" | jq '.'
echo ""
echo ""

# 2. Get Tech Investors portfolio
echo "2️⃣ Getting Tech Investors portfolio..."
TECH_GROUP_ID=$(curl -s "${BASE_URL}/fantasy-portfolio" | jq -r '.[0].groupId')
curl -s "${BASE_URL}/fantasy-portfolio/${TECH_GROUP_ID}" | jq '.'
echo ""
echo ""

# 3. Buy AAPL stock (10 shares)
echo "3️⃣ Buying 10 shares of AAPL in Tech Investors group..."
curl -s -X POST "${BASE_URL}/fantasy-portfolio/trade" \
  -H "Content-Type: application/json" \
  -d "{
    \"groupId\": \"${TECH_GROUP_ID}\",
    \"ticker\": \"AAPL\",
    \"shares\": 10,
    \"tradeType\": \"buy\"
  }" | jq '.'
echo ""
echo ""

# 4. Get portfolio again to see the purchase
echo "4️⃣ Getting Tech Investors portfolio after purchase..."
curl -s "${BASE_URL}/fantasy-portfolio/${TECH_GROUP_ID}" | jq '.'
echo ""
echo ""

# 5. Buy more AAPL (5 shares) - test average cost calculation
echo "5️⃣ Buying 5 more shares of AAPL..."
curl -s -X POST "${BASE_URL}/fantasy-portfolio/trade" \
  -H "Content-Type: application/json" \
  -d "{
    \"groupId\": \"${TECH_GROUP_ID}\",
    \"ticker\": \"AAPL\",
    \"shares\": 5,
    \"tradeType\": \"buy\"
  }" | jq '.'
echo ""
echo ""

# 6. Sell some shares (7 shares)
echo "6️⃣ Selling 7 shares of AAPL..."
curl -s -X POST "${BASE_URL}/fantasy-portfolio/trade" \
  -H "Content-Type: application/json" \
  -d "{
    \"groupId\": \"${TECH_GROUP_ID}\",
    \"ticker\": \"AAPL\",
    \"shares\": 7,
    \"tradeType\": \"sell\"
  }" | jq '.'
echo ""
echo ""

# 7. Final portfolio state
echo "7️⃣ Final portfolio state..."
curl -s "${BASE_URL}/fantasy-portfolio/${TECH_GROUP_ID}" | jq '.'
echo ""

echo "✅ Test complete!"
