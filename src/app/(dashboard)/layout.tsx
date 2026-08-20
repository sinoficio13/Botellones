import { Header } from '@/components/shared/header';
import { MobileNav } from '@/components/navigation/mobile-nav';

/**
 * Dashboard layout: Header + content + mobile bottom nav.
 * Applied to all routes under /(dashboard).
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <Header />
      {/* pb-28 clears the fixed bottom bar on mobile/tablet (112px >= bar + safe-area) */}
      <main id="main-content" className="pb-28 lg:pb-0">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
