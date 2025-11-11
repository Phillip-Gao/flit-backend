# Flit Backend API

A backend API for the Flit financial literacy application - a gamified learning platform that combines the fun elements of Duolingo with strategic investment concepts.

## Features

- **User Management**: Complete CRUD operations for user profiles
- **Financial Gaming Elements**: Learning streaks, IQ scores, and learning dollars
- **RESTful API**: Clean, documented endpoints
- **Database Integration**: PostgreSQL with Prisma ORM
- **Validation**: Input validation with Zod schemas

## API Endpoints

### Users

#### GET /api/users
Get all users with pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response:**
```json
{
  "users": [
    {
      "id": "user_id",
      "email": "user@example.com",
      "username": "username",
      "firstName": "John",
      "lastName": "Doe",
      "isVerified": false,
      "onboardingCompleted": false,
      "financialIQScore": 0,
      "learningStreak": 0,
      "totalLearningDollars": 0,
      "createdAt": "2023-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

#### POST /api/users
Create a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "uniqueusername",
  "firstName": "John",           // optional
  "lastName": "Doe",             // optional
  "dateOfBirth": "1995-01-01",   // optional
  "phoneNumber": "+1234567890"   // optional
}
```

**Response:**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "username": "uniqueusername",
    // ... other user fields
  }
}
```

#### GET /api/users/:id
Get a specific user by ID.

**Response:**
```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "username": "username",
    // ... all user fields
  }
}
```

#### PUT /api/users/:id
Update a user's information.

**Request Body:**
```json
{
  "firstName": "UpdatedName",
  "financialIQScore": 150,
  "learningStreak": 10,
  "onboardingCompleted": true
}
```

#### DELETE /api/users/:id
Delete a user.

**Response:**
```json
{
  "message": "User deleted successfully"
}
```

## User Schema

The User model includes the following fields:

### Basic Information
- `id`: Unique identifier (CUID)
- `email`: Email address (unique)
- `username`: Username (unique)
- `firstName`: First name (optional)
- `lastName`: Last name (optional)
- `dateOfBirth`: Date of birth (optional)
- `phoneNumber`: Phone number (optional)

### Game Mechanics
- `isVerified`: Account verification status
- `onboardingCompleted`: Has completed app onboarding
- `financialIQScore`: User's financial knowledge score (0-∞)
- `learningStreak`: Current learning streak in days
- `totalLearningDollars`: Total virtual currency earned

### Timestamps
- `createdAt`: Account creation date
- `updatedAt`: Last profile update
- `lastLoginAt`: Last login timestamp

## Setup & Development

### Prerequisites
- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repo-url>
cd flit-backend
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your database URL
```

4. Set up the database
```bash
npx prisma db push
npx prisma generate
```

5. Start development server
```bash
npm run dev
```

The server will start on `http://localhost:3000`.

### Testing

Test the API endpoints:
```bash
node scripts/test-api.js
```

### Building for Production

```bash
npm run build
npm start
```

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Validation**: Zod
- **Development**: nodemon, ts-node

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- `200`: Success
- `201`: Created
- `400`: Bad Request (validation errors)
- `404`: Not Found
- `500`: Internal Server Error

Error responses include:
```json
{
  "error": "Error type",
  "message": "Descriptive error message",
  "details": [] // For validation errors
}
```

## Future Enhancements

Based on the system design, future additions will include:

1. **Learning Loop**: Lessons, quizzes, and progress tracking
2. **Portfolio Loop**: Simulated investing and portfolio management
3. **Social Loop**: Leagues, friendships, and competitions
4. **Market Data Integration**: Real-time financial data via external APIs
5. **Caching**: Redis for performance optimization
6. **Background Jobs**: Automated tasks and notifications

## Authentication

Authentication will be handled by a third-party service (Auth0, Supabase, etc.). The current API focuses on user data management after authentication.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Run tests
5. Submit a pull request

## License

[License information]