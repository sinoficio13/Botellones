'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/(auth)/logout/actions';
import {
  ArrowLeftRight,
  Bell,
  Droplets,
  Gift,
  LayoutDashboard,
  LogOut,
  MapPin,
  MoreHorizontal,
  ScanLine,
  Settings,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

// Modal (and the jsqr chunk it imports) is fetched only when the scanner opens.
const ScannerModal = dynamic(
  () => import('@/components/scanner/scanner-modal').then((m) => m.ScannerModal),
  { ssr: false }
);

// Primary destinations shown as bottom-bar tabs (FAB and "Más" fill the rest).
// All links are visible to every user — no role gating on mobile.
const MOBILE_TABS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/recargas', label: 'Recargas', icon: ArrowLeftRight },
  { href: '/clientes', label: 'Clientes', icon: Users },
] as const;

// Secondary destinations inside the "Más" drawer.
const DRAWER_ITEMS = [
  { href: '/botellones', label: 'Botellones', icon: Droplets },
  { href: '/premios', label: 'Premios', icon: Gift },
  { href: '/mapa', label: 'Mapa', icon: MapPin },
  { href: '/reportes', label: 'Reportes', icon: TrendingUp },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
  { href: '/notificaciones', label: 'Notificaciones', icon: Bell },
] as const;

/**
 * Mobile/tablet bottom navigation bar: primary tabs, center scan FAB, and a
 * "Más" drawer with the remaining destinations. Hidden on lg+ viewports,
 * where the desktop header takes over.
 */
export function MobileNav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleScannerClose = useCallback(() => setScannerOpen(false), []);

  // Belt-and-braces: close the drawer on any navigation (covers scanner
  // redirects that resolve after a link click).
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav
        aria-label="Navegación móvil"
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm dark:border-zinc-800 dark:bg-black/95 lg:hidden"
      >
        {MOBILE_TABS.slice(0, 2).map((tab) => (
          <TabLink key={tab.href} tab={tab} active={isActive(tab.href)} />
        ))}

        {/* Center scan FAB */}
        <div className="flex items-start justify-center">
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            aria-label="Escanear QR"
            title="Escanear QR"
            className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white ring-4 ring-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 dark:ring-black"
          >
            <ScanLine className="h-6 w-6" />
          </button>
        </div>

        {MOBILE_TABS.slice(2).map((tab) => (
          <TabLink key={tab.href} tab={tab} active={isActive(tab.href)} />
        ))}

        {/* Más drawer trigger */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Más"
          aria-haspopup="dialog"
          className="flex min-h-[44px] flex-col items-center justify-center gap-1 py-1.5 text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          <MoreHorizontal className="h-6 w-6" />
          <span className="text-[10px]">Más</span>
        </button>
      </nav>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="bottom"
          className="pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader>
            <SheetTitle>Más</SheetTitle>
          </SheetHeader>
          <div className="grid gap-1 px-2 pb-2">
            {DRAWER_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-zinc-100 px-2 pt-1 dark:border-zinc-800">
            <form action={logout} onClick={() => setDrawerOpen(false)}>
              <button
                type="submit"
                className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                Cerrar sesión
              </button>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      {scannerOpen && <ScannerModal onClose={handleScannerClose} />}
    </>
  );
}

function TabLink({
  tab,
  active,
}: {
  tab: (typeof MOBILE_TABS)[number];
  active: boolean;
}) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-[44px] flex-col items-center justify-center gap-1 py-1.5 text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50',
        active &&
          'text-zinc-900 dark:text-zinc-50'
      )}
    >
      <Icon className="h-6 w-6" />
      <span className="text-[10px]">{tab.label}</span>
    </Link>
  );
}