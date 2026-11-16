import type { NextConfig } from "next";

// On Vercel production builds, stop the build if a required setting is missing,
// so a deployment that nobody can sign in to never goes live.
// Only checks that the values exist; it never prints them.
if (process.env.VERCEL_ENV === "production") {
  const problems: string[] = [];
  if ((process.env.SESSION_SECRET ?? "").length < 16) {
    problems.push("SESSION_SECRET is not set or is shorter than 16 characters");
  }
  if (!process.env.DATABASE_URL) {
    problems.push("DATABASE_URL is not set, so contacts would not be saved");
  }
  if (problems.length > 0) {
    throw new Error(
      `Missing production settings:\n- ${problems.join("\n- ")}\n` +
        "Add them in Vercel → Settings → Environment Variables (Production), then redeploy.",
    );
  }
}

const nextConfig: NextConfig = {
  // PGlite (local embedded Postgres) ships WASM + data files; keep it out of the bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
