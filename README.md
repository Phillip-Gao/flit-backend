# Flit Backend

Express API server with Prisma ORM and PostgreSQL (AWS RDS).

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (AWS RDS)
- **ORM**: Prisma
- **Authentication**: Clerk (to be integrated)

## Project Structure

```
flit-backend/
├── src/
│   ├── controllers/      # Route controllers
│   ├── middleware/       # Custom middleware (auth, error handling)
│   ├── routes/           # API routes
│   ├── services/         # Business logic and external services
│   ├── types/            # TypeScript type definitions
│   └── index.ts          # Application entry point
├── prisma/
│   └── schema.prisma     # Database schema
├── .env                  # Environment variables (not in git)
└── .env.example          # Environment variables template
```

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