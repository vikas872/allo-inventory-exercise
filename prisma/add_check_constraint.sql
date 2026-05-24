-- This script adds the crucial check constraint to the Stock table
-- It ensures that reservedUnits can never exceed totalUnits.
-- Run this in your Postgres database AFTER running `npx prisma db push` or `npx prisma migrate dev`.

ALTER TABLE "Stock" ADD CONSTRAINT "check_stock" CHECK ("reservedUnits" <= "totalUnits");
