# Flit Backend

Express API server with Prisma ORM and PostgreSQL (AWS RDS).

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (AWS RDS)
- **ORM**: Prisma
- **Authentication**: Clerk (to be integrated)

## Project Structure

# Flit Backend - Development Environment Setup

## Overview
This is the backend API for the Flit financial literacy app. It provides user management endpoints and integrates with a PostgreSQL database using Prisma ORM.

## Quick Start

### Option 1: Docker Development (Recommended for local development)

1. **Clone and setup**
   ```bash
   git clone <repository-url>
   cd flit-backend
   npm install
   ```

2. **Start Docker services**
   
   Older version
   ```bash
   docker-compose up -d
   ```
   Newer version
   ```bash
   docker compose up -d
   ```
   This starts:
   - PostgreSQL database on port 5433
   - Redis cache on port 6379
   - pgAdmin on port 8080

4. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit DATABASE_URL to use Docker: 
   # DATABASE_URL="postgresql://postgres:flit1234567@localhost:5433/flit_dev?schema=public"
   ```

5. **Initialize database**
   ```bash
   npm run db:push
   npm run db:seed  # Optional: add sample data
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000`

### Option 2: Local PostgreSQL

1. **Install PostgreSQL locally**
   ```bash
   brew install postgresql  # macOS
   brew services start postgresql
   ```

2. **Create database**
   ```bash
   createdb flit_dev
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your local database URL
   ```

4. **Continue from step 4 above**

### Option 3: AWS RDS Production

1. **Configure environment for production**
   ```bash
   cp .env.example .env
   # Edit .env with AWS RDS connection string
   ```

2. **Deploy to cloud platform** (see deployment section below)

## Environment Configuration

### Development (.env.local)
- Uses Docker PostgreSQL on port 5433
- Local development JWT secret
- CORS enabled for frontend dev servers

### Production (.env with AWS RDS)
- Uses AWS RDS PostgreSQL instance
- Secure JWT secret (use environment variable)
- Production CORS origins

## API Endpoints

### Health Check
- `GET /health` - Service health status

### Users
- `GET /api/users` - List users (with pagination)
- `POST /api/users` - Create new user
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Example Usage
```bash
# Create a user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "firstName": "Test",
    "lastName": "User",
    "dateOfBirth": "1990-01-01"
  }'

# Get all users
curl http://localhost:3000/api/users
```

## Database Management

### Docker Environment
```bash
# Push schema changes
npm run db:push

# Reset database
npm run db:reset

# View database in pgAdmin
# Open http://localhost:8080
# Email: admin@admin.com, Password: root
```

### Access pgAdmin (Docker)
1. Open http://localhost:8080
2. Login with:
   - Email: admin@admin.com
   - Password: root
3. Add server:
   - Host: postgres
   - Port: 5432
   - Database: flit_dev
   - Username: postgres
   - Password: flit1234567

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run db:push      # Push schema to database
npm run db:reset     # Reset database
npm run db:seed      # Seed database with sample data
npm run test:api     # Test API endpoints
npm run test:db      # Test database connection
```

## Docker Services

### PostgreSQL
- Port: 5433 (external), 5432 (internal)
- Database: flit_dev
- User: postgres
- Password: flit1234567

### Redis
- Port: 6379
- Used for session storage and caching

### pgAdmin
- Port: 8080
- Web interface for database management

## Deployment

### AWS ECS (Production)
1. **Build Docker image**
   ```bash
   docker build -t flit-backend .
   ```

2. **Push to ECR**
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
   docker tag flit-backend:latest <account>.dkr.ecr.us-east-1.amazonaws.com/flit-backend:latest
   docker push <account>.dkr.ecr.us-east-1.amazonaws.com/flit-backend:latest
   ```

3. **Deploy with ECS service**

### Environment Variables (Production)
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://username:password@rds-endpoint:5432/database
JWT_SECRET=your-production-jwt-secret
ALLOWED_ORIGINS=https://yourdomain.com
```

## Development Team Setup

Each team member can choose their preferred setup:

1. **Docker (Easiest)**: Just run `docker-compose up -d` and `cp .env.local .env`
2. **Local PostgreSQL**: Install PostgreSQL locally and configure .env
3. **Shared AWS RDS**: Use the production database for development (not recommended)

The Docker option ensures consistent development environment across all machines.

## Troubleshooting

### Database Connection Issues
```bash
# Test database connectivity
npm run test:db

# Check Docker services
docker-compose ps

# View logs
docker-compose logs postgres
```

### Port Conflicts
If ports 5433, 6379, or 8080 are in use:
```bash
# Check what's using the port
lsof -i :5433

# Modify docker-compose.yml to use different ports
```

### Permission Issues (macOS)
```bash
# Fix Docker permissions
sudo chown -R $USER:staff ~/.docker
```

## Database Schema

The User model includes:
- Basic info: email, username, name, date of birth
- Game mechanics: financialIQScore, learningStreak, totalLearningDollars
- Status flags: emailVerified, phoneVerified, onboardingComplete
- Timestamps: createdAt, updatedAt

See `prisma/schema.prisma` for the complete schema definition.

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL database (AWS RDS)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

3. Update the `.env` file with your AWS RDS credentials:
```
DATABASE_URL="postgresql://username:password@your-rds-endpoint.region.rds.amazonaws.com:5432/flit_db?schema=public"
```

4. Generate Prisma Client:
```bash
npm run prisma:generate
```

5. Run database migrations:
```bash
npm run prisma:migrate
```

### Development

Start the development server with hot reload:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Run production server
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:push` - Push schema changes to database
- `npm run prisma:studio` - Open Prisma Studio (database GUI)

## Database Setup (AWS RDS)

1. Create a PostgreSQL instance on AWS RDS
2. Configure security groups to allow connections from your IP
3. Note down the endpoint, port, database name, username, and password
4. Update the `DATABASE_URL` in your `.env` file

## API Endpoints

### Health Check
```
GET /health
```
Returns server status and timestamp.

### API Root
```
GET /api
```
Returns API welcome message.

## Next Steps

- [ ] Add database models to `prisma/schema.prisma`
- [ ] Integrate Clerk authentication
- [ ] Create API routes in `src/routes/`
- [ ] Add controllers in `src/controllers/`
- [ ] Implement business logic in `src/services/`
