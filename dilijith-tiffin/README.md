# Dilijith Tiffin Service (MERN Stack)

Full-stack MERN application for Dilijith Tiffin Service with React + Vite frontend, Express + Node.js backend, and persistent MongoDB database storage.

---

## 1. Prerequisites

- **Node.js**: v18.0.0 or higher
- **MongoDB**: An existing MongoDB Atlas cluster or local MongoDB instance (viewable via MongoDB Compass)

---

## 2. Configuration & Environment Variables

Create a [`.env`](.env) file in the project root directory (copied from [`.env.example`](.env.example)):

```env
# ==========================================
# Backend Configuration (Node / Express)
# ==========================================
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.krqi54p.mongodb.net
MONGODB_DB_NAME=dilijith_tiffin
JWT_SECRET=your_jwt_secret_here

# ==========================================
# Frontend Configuration (Vite)
# ==========================================
VITE_API_URL=http://localhost:5000/api
VITE_WHATSAPP_NUMBER=
```

### Where to Find Your MongoDB Connection URI:
- **MongoDB Atlas**:
  1. Log into your MongoDB Atlas dashboard.
  2. Click **Database** under Deployment, then click **Connect**.
  3. Choose **Drivers** (Node.js) or **Compass**.
  4. Copy the connection string format: `mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net`.
  5. Replace `<username>` and `<password>` with your database user credentials.
- **Local MongoDB**:
  - `mongodb://localhost:27017/dilijith_tiffin`

> **Note:** Never commit the `.env` file to Git. [`.gitignore`](.gitignore) ensures it is ignored.

---

## 3. Installation & Starting the Application

### Install Dependencies:
```bash
npm install
```

### Start the Backend (Terminal 1):
```bash
npm run server
```
- Starts the Express backend on port `5000`.
- Connects securely to your MongoDB database using Mongoose.
- Automatically initializes initial data if the database is empty.
- Health check available at: `http://localhost:5000/api/health`

### Start the Frontend (Terminal 2):
```bash
npm run dev
```
- Starts the Vite development server on `http://localhost:5173`.
- Communicates with the backend API via `http://localhost:5000/api`.

---

## 4. Testing & Verification

Run all test suites:

```bash
# Run all unit tests (accounting, customer logic, meal allocation)
npm test

# Run the live MongoDB integration tests
npm run test:integration
```

---

## 5. MongoDB Collections in MongoDB Compass

When you open **MongoDB Compass** and connect to your database (`dilijith_tiffin`), you will see the following collections:

1. **`users`**: User records with uniquely indexed emails, bcrypt-hashed passwords, and roles (`admin` / `user`).
2. **`subscriptions`**: Independent meal allocations tracking `mealTypes` (breakfast, lunch, dinner), `allocatedMeals`, `consumedMeals`, `approvedAdjustments`, start/end dates, and status.
3. **`mealrecords`**: Scheduled, Consumed, and Cancelled meal records with compound uniqueness per subscription/date/meal.
4. **`creditadjustments`**: Auditable credit adjustments (+/- credits with reasons).
5. **`activities`**: Persistent audit log of allocations, renewals, cancellations, and meal activity.

---

## 6. API Endpoints

### Health & Connectivity
- `GET /api/health`: Health check reporting server and database connection status.

### Authentication
- `POST /api/auth/register`: Register a new user (`name`, `email`, `password`, `phone`).
- `POST /api/auth/login`: Login with email and password, returns JWT token.
- `POST /api/auth/demo`: Demo switcher login (issues valid JWT token for demo accounts).
- `GET /api/auth/me`: Fetch currently authenticated user profile.

### Admin Operations (Protected: Admin role required)
- `GET /api/admin/state`: Fetch full current state from MongoDB.
- `GET /api/admin/dashboard`: Daily prep count summary and metrics.
- `GET /api/admin/users`: Search and list all registered customers.
- `POST /api/admin/users`: Create a customer record.
- `POST /api/admin/subscriptions/allocate`: Allocate independent breakfast, lunch, or dinner credits.
- `POST /api/admin/subscriptions/:id/adjust`: Auditable credit adjustment (+/-) with negative balance protection.
- `POST /api/admin/subscriptions/:id/renew`: Extend subscription duration and add renewal credits.
- `POST /api/admin/subscriptions/:id/cancel`: Cancel subscription and cancel future scheduled meals.

### Customer Operations (Protected: Customer role)
- `GET /api/user/dashboard`: Customer dashboard metrics with independent per-meal balances.
- `GET /api/user/meals/today`: Today's breakfast, lunch, and dinner status with cancellation cutoff checks.
- `GET /api/user/meals/recent`: Recent meal consumption and cancellation history.
- `POST /api/user/meals/:id/cancel`: Cancel a meal before deadline (credit is preserved).
