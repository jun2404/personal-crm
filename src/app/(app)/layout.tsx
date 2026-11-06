// Every page here shows live data from the database, so never pre-render at build time.
export const dynamic = "force-dynamic";

import { BottomNav, TopNav } from "@/components/crm/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-28 md:pb-12">{children}</main>
      <BottomNav />
    </>
  );
}
