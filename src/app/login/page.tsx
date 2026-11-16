import type { Metadata } from "next";
import Link from "next/link";
import { hasUnclaimedData } from "@/lib/server/data";
import { AuthShell } from "./auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const unclaimed = await hasUnclaimedData().catch((err) => {
    console.error("Could not check for contacts saved before accounts existed.", err);
    return false;
  });
  return (
    <AuthShell active="login" next={next}>
      {unclaimed && (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          Personal CRM now has accounts. Used it before with a single password?{" "}
          <Link href="/signup" className="font-medium underline underline-offset-2">
            Create your account
          </Link>{" "}
          and your saved contacts come with you.
        </p>
      )}
      <LoginForm next={next} />
    </AuthShell>
  );
}
