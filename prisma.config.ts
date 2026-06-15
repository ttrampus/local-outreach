// Prisma CLI config. Next.js loads .env.local automatically at runtime, but the
// Prisma CLI does not — so we load it here too, keeping all config in one file.
// .env.local wins over .env when both define a key.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
