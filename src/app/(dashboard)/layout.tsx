import { Header } from '@/components/shared/header';

/**
 * Dashboard layout: Header + content.
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
      <main id="main-content">{children}</main>
    </div>
  );
}
