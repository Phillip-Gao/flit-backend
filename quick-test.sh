#!/bin/bash

echo "=== Quick Fantasy Finance API Test ==="
echo ""

# 1. Create users
echo "1. Creating users..."
curl -s -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"player1@example.com","password":"password123","displayName":"Player One"}'
echo ""

curl -s -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"player2@example.com","password":"password123","displayName":"Player Two"}'
echo ""
echo ""

# 2. Get all users
echo "2. Getting all users..."
curl -s http://localhost:3000/api/users
echo ""
echo ""

# 3. Create a league
echo "3. Creating a Fantasy League..."
curl -s -X POST http://localhost:3000/api/fantasy-leagues \
  -H "Content-Type: application/json" \
  -d '{"name":"Tech Stock Champions","description":"A league for tech enthusiasts","maxMembers":6,"adminUserId":1,"settings":{"portfolioSize":5,"benchSize":2,"draftType":"snake","scoringType":"weekly"}}'
echo ""
echo ""

# 4. Get league details
echo "4. Getting league details..."
curl -s http://localhost:3000/api/fantasy-leagues/1
echo ""
echo ""

# 5. User 2 joins league
echo "5. User 2 joining league..."
curl -s -X POST http://localhost:3000/api/fantasy-leagues/1/join \
  -H "Content-Type: application/json" \
  -d '{"userId":2}'
echo ""
echo ""

# 6. List all leagues
echo "6. Listing all leagues..."
curl -s http://localhost:3000/api/fantasy-leagues
echo ""
echo ""

echo "✅ Test complete!"
