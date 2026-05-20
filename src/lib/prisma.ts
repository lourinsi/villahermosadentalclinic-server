import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const needsSupabasePoolerSsl =
  connectionString.includes(".supabase.com") ||
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "false";

const adapter = new PrismaPg({
  connectionString,
  ssl: needsSupabasePoolerSsl ? { rejectUnauthorized: false } : undefined,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
