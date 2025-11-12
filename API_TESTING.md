# Flit Backend API Testing Guide

## Setup Commands

```bash
# 1. Setup and start services
docker-compose up -d
npm install
cp .env.example .env
npm run db:push
npm run db:seed

# 2. Start development server
npm run dev
```

## User Management API

### Get All Users
```bash
curl http://localhost:3000/api/users
```

### Create User
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "firstName": "Test",
    "lastName": "User",
    "dateOfBirth": "1995-01-01T00:00:00.000Z"
  }'
```

### Get User by ID
```bash
curl http://localhost:3000/api/users/USER_ID
```

### Update User
```bash
curl -X PUT http://localhost:3000/api/users/USER_ID \
  -H "Content-Type: application/json" \
  -d '{
    "financialIQScore": 900,
    "learningStreak": 50
  }'
```

## Lesson Management API

### Get All Lessons
```bash
curl http://localhost:3000/api/lessons
```

### Get Lessons by Category
```bash
curl "http://localhost:3000/api/lessons?category=investing&difficulty=beginner"
```

### Create Lesson
```bash
curl -X POST http://localhost:3000/api/lessons \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Advanced Portfolio Management",
    "description": "Learn to optimize your investment portfolio",
    "content": "Detailed content about portfolio management...",
    "category": "investing",
    "difficulty": "advanced",
    "estimatedTime": 45,
    "rewardDollars": 35,
    "order": 5
  }'
```

### Get Lesson Progress
```bash
curl http://localhost:3000/api/lessons/LESSON_ID/progress/USER_ID
```

### Update Lesson Progress
```bash
curl -X PUT http://localhost:3000/api/lessons/LESSON_ID/progress/USER_ID \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "progress": 100,
    "score": 95,
    "timeSpent": 42
  }'
```

## Portfolio Management API

### Get User Portfolio
```bash
curl http://localhost:3000/api/portfolio/USER_ID
```

### Add Stock Holding
```bash
curl -X POST http://localhost:3000/api/portfolio/USER_ID/holdings \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "MSFT",
    "companyName": "Microsoft Corporation",
    "shares": 15,
    "averageCost": 300.00
  }'
```

### Get Specific Holding
```bash
curl http://localhost:3000/api/portfolio/USER_ID/holdings/AAPL
```

### Update Stock Price
```bash
curl -X PUT http://localhost:3000/api/portfolio/USER_ID/holdings/AAPL \
  -H "Content-Type: application/json" \
  -d '{
    "currentPrice": 185.00
  }'
```

### Add Transaction
```bash
curl -X POST http://localhost:3000/api/portfolio/USER_ID/holdings/AAPL/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "type": "buy",
    "shares": 5,
    "price": 180.00,
    "fees": 2.50,
    "notes": "Additional shares purchase"
  }'
```

## Social Features API

### Get Social Feed
```bash
curl http://localhost:3000/api/social/feed
```

### Get Social Feed for Specific User (includes followed users)
```bash
curl "http://localhost:3000/api/social/feed?userId=USER_ID&page=1&limit=10"
```

### Create Social Post
```bash
curl -X POST http://localhost:3000/api/social/posts \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "content": "Just hit my savings goal for this month! 💰 Compound interest is amazing!",
    "type": "achievement",
    "isPublic": true
  }'
```

### Get User Posts
```bash
curl http://localhost:3000/api/social/posts/USER_ID
```

### Like/Unlike Post
```bash
curl -X POST http://localhost:3000/api/social/posts/POST_ID/like \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID"
  }'
```

### Add Comment to Post
```bash
curl -X POST http://localhost:3000/api/social/posts/POST_ID/comments \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "content": "Great achievement! Keep it up! 👏"
  }'
```

### Get Post Comments
```bash
curl http://localhost:3000/api/social/posts/POST_ID/comments
```

### Follow/Unfollow User
```bash
curl -X POST http://localhost:3000/api/social/follow \
  -H "Content-Type: application/json" \
  -d '{
    "followerId": "USER_ID_1",
    "followingId": "USER_ID_2"
  }'
```

### Get User Followers
```bash
curl http://localhost:3000/api/social/users/USER_ID/followers
```

### Get Users Following
```bash
curl http://localhost:3000/api/social/users/USER_ID/following
```

## Test Sequence Example

Here's a complete test sequence you can run:

```bash
# 1. Get all users to find user IDs
curl http://localhost:3000/api/users

# 2. Get all lessons to find lesson IDs  
curl http://localhost:3000/api/lessons

# 3. Check portfolio (should have seeded data)
curl http://localhost:3000/api/portfolio/USER_ID

# 4. Get social feed
curl http://localhost:3000/api/social/feed

# 5. Create a new post
curl -X POST http://localhost:3000/api/social/posts \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "content": "Testing the new API! 🚀",
    "type": "general"
  }'

# 6. Update lesson progress
curl -X PUT http://localhost:3000/api/lessons/LESSON_ID/progress/USER_ID \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "progress": 50,
    "timeSpent": 15
  }'
```

## Health Check

```bash
curl http://localhost:3000/health
```

## Notes

- Replace `USER_ID`, `LESSON_ID`, `POST_ID` with actual IDs from the seeded data
- Use the seeded data to get real IDs for testing
- All endpoints support pagination with `?page=1&limit=10` query parameters
- The database is seeded with sample users, lessons, portfolio holdings, and social posts