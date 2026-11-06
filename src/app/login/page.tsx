import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-primary text-base font-bold text-primary-foreground">
            PC
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Personal CRM</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everyone you&apos;ve met, and when to reach out next.</p>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
