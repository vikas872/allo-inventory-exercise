# Allo Inventory Reservation System

An end-to-end inventory reservation system designed to safely handle concurrent checkouts and avoid race conditions. Built for the Allo Take-Home Exercise.

## Core Concurrency Strategy

The most critical requirement of this project was to handle race conditions during the checkout window. If multiple customers attempt to purchase the final unit of stock simultaneously, only one must succeed.

To guarantee this, we rely on **PostgreSQL database constraints** combined with **Prisma's atomic updates**.
1. We apply a `CHECK ("reservedUnits" <= "totalUnits")` constraint on the `Stock` table.
2. During the reservation (`POST /api/reservations`), we atomically increment `reservedUnits`. 
3. If concurrent requests push `reservedUnits` beyond `totalUnits`, PostgreSQL rejects the transaction, throwing a constraint violation error. We catch this error and gracefully return a `409 Conflict`.

This avoids the complexity and overhead of distributed locking (e.g., via Redis Redlock) while providing the strictest consistency guarantees (ACID).

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL (via Supabase / Neon)
- **ORM:** Prisma
- **Idempotency:** Upstash Redis
- **Styling:** Tailwind CSS + shadcn/ui

## Running Locally

1. **Clone and Install**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Rename `.env.example` to `.env` and fill in your credentials.
   - `DATABASE_URL`: A hosted PostgreSQL connection string (Supabase, Neon).
   - `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`: For idempotency.

3. **Database Setup**
   Push the schema to your database:
   ```bash
   npx prisma db push
   ```

   **Crucial Step:** Apply the check constraint.
   Run the SQL command found in `prisma/add_check_constraint.sql` directly in your database console (Supabase SQL Editor or Neon SQL Editor):
   ```sql
   ALTER TABLE "Stock" ADD CONSTRAINT "check_stock" CHECK ("reservedUnits" <= "totalUnits");
   ```

4. **Seed the Database**
   ```bash
   npm run prisma db seed
   ```

5. **Start the Development Server**
   ```bash
   npm run dev
   ```

## Production Expiry Mechanism

Reservations expire automatically after a set time (e.g., 10 minutes). To release these locks:

1. **Vercel Cron Job:** 
   The endpoint `POST /api/cron/expire-reservations` is designed to be triggered periodically (e.g., every minute) by Vercel Cron.
2. **Execution:** 
   The job finds all `PENDING` reservations where `expiresAt < NOW()`. Inside a database transaction, it marks them as `RELEASED` and decrements `reservedUnits` in the `Stock` table, making the stock immediately available to new shoppers.
3. **Lazy Expiry UI:** 
   The frontend UI has a live countdown. When the timer hits zero, the UI automatically updates to reflect the expired state, preventing the user from submitting a doomed "confirm" request. If they somehow do, the `confirm` API endpoint also double-checks `expiresAt` and returns `410 Gone`.

## Idempotency (Bonus)

The `/api/reservations`, `/confirm`, and `/release` endpoints support idempotency.
If the client includes an `Idempotency-Key` header, the application checks Upstash Redis. If a response is already cached for that key, it returns the cached response instead of repeating the side effect. 

## Trade-offs & Future Improvements

1. **Strict Postgres Constraints vs Redis Locking:**
   I chose to handle the core race condition at the Postgres level. While distributed locking with Redis is popular, an RDBMS check constraint is significantly safer and requires fewer network hops. However, if the app needed to scale to a multi-database architecture or handle extreme global throughput, moving inventory tracking entirely to an in-memory datastore (like Redis) with Lua scripts would be necessary.
2. **Cron Job vs Event-Driven Expiry:**
   A polling cron job is simple and reliable for this scale. With more time, a more immediate expiry mechanism could use a message broker with delayed queues (like AWS SQS or RabbitMQ), or Redis Keyspace Notifications to release stock the exact second a reservation expires, rather than waiting for the next cron tick.
3. **Authentication:**
   Currently, the system doesn't attach reservations to a specific user or session ID, which allows anyone with the reservation ID to confirm/cancel. In a real system, we'd integrate NextAuth or Clerk and validate ownership.
