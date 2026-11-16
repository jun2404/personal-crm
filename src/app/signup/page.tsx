import type { Metadata } from "next";
import { hasUnclaimedData } from "@/lib/server/data";
import { AuthShell } from "../login/auth-shell";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const canClaim = await hasUnclaimedData().catch((err) => {
    console.error("Could not check for contacts saved before accounts existed.", err);
    return false;
  });
  return (
    <AuthShell active="signup" next={next}>
      <SignupForm canClaim={canClaim} />
    </AuthShell>
  );
}
