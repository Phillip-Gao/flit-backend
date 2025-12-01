#!/bin/bash

# Fantasy Finance API Test Script
# This script tests the complete Fantasy Finance workflow

BASE_URL="http://localhost:3000"
echo "=== Fantasy Finance API Testing ==="
echo "Base URL: $BASE_URL"
echo ""

# 1. Create test users
echo "1️⃣  Creating test users..."
USER1=$(curl -s -X POST "$BASE_URL/api/users" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "player1@example.com",
    "password": "password123",
    "displayName": "Player One"
  }')
echo "User 1: $USER1"

USER2=$(curl -s -X POST "$BASE_URL/api/users" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "player2@example.com",
    "password": "password123",
    "displayName": "Player Two"
  }')
echo "User 2: $USER2"

USER3=$(curl -s -X POST "$BASE_URL/api/users" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "player3@example.com",
    "password": "password123",
    "displayName": "Player Three"
  }')
echo "User 3: $USER3"
echo ""

# Extract user IDs (using jq if available, otherwise showing full response)
if command -v jq &> /dev/null; then
    USER1_ID=$(echo "$USER1" | jq -r '.id')
    USER2_ID=$(echo "$USER2" | jq -r '.id')
    USER3_ID=$(echo "$USER3" | jq -r '.id')
    echo "User IDs: $USER1_ID, $USER2_ID, $USER3_ID"
else
    echo "Note: Install jq for better JSON parsing"
    USER1_ID=1
    USER2_ID=2
    USER3_ID=3
fi
echo ""

# 2. Create lessons
echo "2️⃣  Creating lessons..."
LESSON1=$(curl -s -X POST "$BASE_URL/lessons" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Basics of Stock Trading",
    "description": "Learn the fundamentals of stock trading",
    "lessonType": "trading",
    "content": {"modules": ["What are stocks?", "How to buy/sell", "Market orders"]},
    "difficulty": "beginner",
    "estimatedMinutes": 15,
    "prerequisites": []
  }')
echo "Lesson 1: $LESSON1"

LESSON2=$(curl -s -X POST "$BASE_URL/lessons" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Understanding Cryptocurrency",
    "description": "Introduction to crypto trading",
    "lessonType": "crypto",
    "content": {"modules": ["What is crypto?", "Blockchain basics", "Trading crypto"]},
    "difficulty": "intermediate",
    "estimatedMinutes": 20,
    "prerequisites": []
  }')
echo "Lesson 2: $LESSON2"
echo ""

# Extract lesson IDs
if command -v jq &> /dev/null; then
    LESSON1_ID=$(echo "$LESSON1" | jq -r '.id')
    LESSON2_ID=$(echo "$LESSON2" | jq -r '.id')
    echo "Lesson IDs: $LESSON1_ID, $LESSON2_ID"
else
    LESSON1_ID=1
    LESSON2_ID=2
fi
echo ""

# 3. Create assets with lesson requirements
echo "3️⃣  Creating assets (stocks, ETFs, crypto)..."
ASSET_AAPL=$(curl -s -X POST "$BASE_URL/fantasy/assets" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "assetName": "Apple Inc.",
    "assetType": "stock",
    "requiredLessons": [1]
  }')
echo "Asset AAPL: $ASSET_AAPL"

ASSET_TSLA=$(curl -s -X POST "$BASE_URL/fantasy/assets" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "TSLA",
    "assetName": "Tesla Inc.",
    "assetType": "stock",
    "requiredLessons": [1]
  }')
echo "Asset TSLA: $ASSET_TSLA"

ASSET_BTC=$(curl -s -X POST "$BASE_URL/fantasy/assets" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC",
    "assetName": "Bitcoin",
    "assetType": "crypto",
    "requiredLessons": [1, 2]
  }')
echo "Asset BTC: $ASSET_BTC"

ASSET_SPY=$(curl -s -X POST "$BASE_URL/fantasy/assets" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "SPY",
    "assetName": "SPDR S&P 500 ETF",
    "assetType": "etf",
    "requiredLessons": []
  }')
echo "Asset SPY: $ASSET_SPY"
echo ""

# 4. Mark lessons as completed for User 1
echo "4️⃣  Completing lessons for User 1..."
COMPLETE1=$(curl -s -X PUT "$BASE_URL/users/$USER1_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"player1@example.com\",
    \"displayName\": \"Player One\",
    \"completedLessons\": [1, 2]
  }")
echo "User 1 completed lessons: $COMPLETE1"
echo ""

# 5. Create a Fantasy League
echo "5️⃣  Creating Fantasy League..."
LEAGUE=$(curl -s -X POST "$BASE_URL/fantasy-leagues" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Tech Stock Champions\",
    \"description\": \"A league for tech enthusiasts\",
    \"maxMembers\": 6,
    \"adminUserId\": $USER1_ID,
    \"settings\": {
      \"portfolioSize\": 5,
      \"benchSize\": 2,
      \"draftType\": \"snake\",
      \"scoringType\": \"weekly\"
    }
  }")
echo "League: $LEAGUE"

if command -v jq &> /dev/null; then
    LEAGUE_ID=$(echo "$LEAGUE" | jq -r '.id')
    echo "League ID: $LEAGUE_ID"
else
    LEAGUE_ID=1
fi
echo ""

# 6. Users join the league
echo "6️⃣  Users joining league..."
JOIN2=$(curl -s -X POST "$BASE_URL/fantasy-leagues/$LEAGUE_ID/join" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": $USER2_ID}")
echo "User 2 joined: $JOIN2"

JOIN3=$(curl -s -X POST "$BASE_URL/fantasy-leagues/$LEAGUE_ID/join" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": $USER3_ID}")
echo "User 3 joined: $JOIN3"
echo ""

# 7. Get league details
echo "7️⃣  Getting league details..."
LEAGUE_DETAILS=$(curl -s -X GET "$BASE_URL/fantasy-leagues/$LEAGUE_ID")
echo "League details: $LEAGUE_DETAILS"
echo ""

# 8. Initialize draft
echo "8️⃣  Initializing draft..."
DRAFT_INIT=$(curl -s -X POST "$BASE_URL/fantasy-draft/$LEAGUE_ID/initialize")
echo "Draft initialized: $DRAFT_INIT"
echo ""

# 9. Get draft state
echo "9️⃣  Getting draft state..."
DRAFT_STATE=$(curl -s -X GET "$BASE_URL/fantasy-draft/$LEAGUE_ID/state")
echo "Draft state: $DRAFT_STATE"
echo ""

# 10. Get available assets for User 1 (should see all since they completed lessons)
echo "🔟  Getting available assets for User 1..."
ASSETS_USER1=$(curl -s -X GET "$BASE_URL/fantasy-draft/$LEAGUE_ID/available-assets?userId=$USER1_ID")
echo "Assets for User 1: $ASSETS_USER1"
echo ""

# 11. Get available assets for User 2 (should see limited assets)
echo "1️⃣1️⃣  Getting available assets for User 2..."
ASSETS_USER2=$(curl -s -X GET "$BASE_URL/fantasy-draft/$LEAGUE_ID/available-assets?userId=$USER2_ID")
echo "Assets for User 2: $ASSETS_USER2"
echo ""

# 12. Make draft picks
echo "1️⃣2️⃣  Making draft picks..."
# User 1's turn (pick 1)
PICK1=$(curl -s -X POST "$BASE_URL/fantasy-draft/$LEAGUE_ID/pick" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": $USER1_ID, \"assetSymbol\": \"AAPL\"}")
echo "Pick 1 (User 1 - AAPL): $PICK1"

# User 2's turn (pick 2)
PICK2=$(curl -s -X POST "$BASE_URL/fantasy-draft/$LEAGUE_ID/pick" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": $USER2_ID, \"assetSymbol\": \"SPY\"}")
echo "Pick 2 (User 2 - SPY): $PICK2"

# User 3's turn (pick 3)
PICK3=$(curl -s -X POST "$BASE_URL/fantasy-draft/$LEAGUE_ID/pick" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": $USER3_ID, \"assetSymbol\": \"TSLA\"}")
echo "Pick 3 (User 3 - TSLA): $PICK3"
echo ""

# 13. Get updated draft state
echo "1️⃣3️⃣  Getting updated draft state..."
DRAFT_STATE_UPDATED=$(curl -s -X GET "$BASE_URL/fantasy-draft/$LEAGUE_ID/state")
echo "Updated draft state: $DRAFT_STATE_UPDATED"
echo ""

# 14. Get User 1's fantasy portfolio (after draft picks)
echo "1️⃣4️⃣  Getting User 1's fantasy portfolio..."
PORTFOLIO1=$(curl -s -X GET "$BASE_URL/fantasy/portfolios/$LEAGUE_ID/user/$USER1_ID")
echo "User 1's portfolio: $PORTFOLIO1"
echo ""

# 15. Search for assets in the market
echo "1️⃣5️⃣  Searching for assets..."
SEARCH=$(curl -s -X GET "$BASE_URL/fantasy/assets/search?query=stock")
echo "Asset search (stock): $SEARCH"
echo ""

echo "✅ Testing complete!"
echo ""
echo "Next steps to test manually:"
echo "- Complete the draft by making more picks"
echo "- Test portfolio lineup updates (move assets between active/bench)"
echo "- Create matchups between users"
echo "- Submit trade proposals"
echo "- Submit waiver claims"
echo "- Check notifications"
