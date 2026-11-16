// Every page here shows live data from the database, so never pre-render at build time.
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { BottomNav, TopNav } from "@/components/crm/nav";
import { getCurrentUser } from "@/lib/server/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // A signed cookie for an account that no longer exists: send them to sign in again.
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <>
      <TopNav user={{ name: user.name, email: user.email }} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-28 md:pb-12">{children}</main>
      <BottomNav />
    </>
  );
}
