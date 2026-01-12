# POS Backend System

A Point of Sale (POS) backend system for restaurant/fast food establishments built with Express.js, Prisma, and PostgreSQL.

## Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Prisma** - ORM for database management
- **PostgreSQL** - Database
- **JWT** - Authentication
- **bcryptjs** - Password hashing

## Project Structure

```
pos-backend/
├── prisma/
│   └── schema.prisma          # Prisma schema definition
├── src/
│   ├── config/
│   │   └── database.js        # Prisma client configuration
│   ├── controllers/
│   │   └── auth.controller.js # Authentication controllers
│   ├── middleware/
│   │   └── auth.middleware.js # Authentication middleware
│   ├── routes/
│   │   └── auth.routes.js     # Authentication routes
│   ├── services/
│   │   └── auth.service.js    # Authentication business logic
│   ├── utils/
│   │   └── validation.js      # Validation utilities
│   ├── scripts/
│   │   └── seedUsers.js       # Database seeding script
│   ├── app.js                 # Express app configuration
│   └── server.js              # Server entry point
├── .env                       # Environment variables (create from .env.example)
├── .env.example               # Example environment variables
└── package.json
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/pos_system?schema=public"
```

### 3. Database Setup

1. Make sure PostgreSQL is installed and running
2. Create a database (or use an existing one)
3. Update the `DATABASE_URL` in your `.env` file

### 4. Prisma Setup

Generate Prisma Client:
```bash
npm run prisma:generate
```

Run migrations to create database tables:
```bash
npm run prisma:migrate
```

### 5. Seed Database (Optional)

Create sample users for testing:
```bash
npm run seed
```

### 6. Start Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Endpoints

### Authentication

#### POST /api/auth/login
Login and receive JWT token.

**Request Body:**
```json
{
  "username": "manager1",
  "password": "manager123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "username": "manager1",
      "email": "manager@restaurant.com",
      "role": "Manager",
      "firstName": "John",
      "lastName": "Manager"
    }
  }
}
```

**Error Responses:**
- `401` - Invalid credentials
- `401` - Account is inactive (isActive=false)
- `400` - Validation errors

#### POST /api/auth/change-password
Change user's own password (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "NewPassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error Responses:**
- `401` - Invalid or missing token
- `401` - Current password is incorrect
- `400` - Validation errors (new password must be different, meet requirements)

#### GET /api/auth/me
Get current authenticated user profile.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "manager1",
      "email": "manager@restaurant.com",
      "role": "Manager",
      "firstName": "John",
      "lastName": "Manager",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

## Database Schema

### User Model

```prisma
model User {
  id        String   @id @default(uuid())
  username  String   @unique
  email     String   @unique
  password  String
  role      UserRole @default(User)  # Manager or User
  isActive  Boolean  @default(true)
  firstName String?
  lastName  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Scripts

- `npm start` - Start server in production mode
- `npm run dev` - Start server in development mode with auto-reload
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio (database GUI)
- `npm run seed` - Seed database with sample users

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment (development/production) | `development` |
| `JWT_SECRET` | Secret key for JWT tokens | Required |
| `JWT_EXPIRES_IN` | Token expiration time | `7d` |
| `DATABASE_URL` | PostgreSQL connection string | Required |

## Security Features

- Password hashing with bcrypt
- JWT-based stateless authentication
- Role-based access control (Manager/User)
- Account activation check (isActive)
- Input validation and sanitization
- Error handling with appropriate status codes

## Development

The project follows MVC (Model-View-Controller) architecture:

- **Models**: Defined in Prisma schema
- **Controllers**: Handle HTTP requests/responses (`src/controllers/`)
- **Services**: Business logic layer (`src/services/`)
- **Routes**: Define API endpoints (`src/routes/`)
- **Middleware**: Authentication and validation (`src/middleware/`, `src/utils/`)

## Notes

- All passwords are hashed using bcrypt before storage
- JWT tokens expire after 7 days (configurable)
- Inactive users (isActive=false) are denied access on login
- Passwords must be at least 6 characters long
- New passwords must contain uppercase, lowercase, and numbers
