import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { SkipLink } from '@/components/a11y/skip-link';
import { PwaShell } from '@/components/pwa/pwa-shell';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Botellón',
  description: 'Gestión de botellones de agua',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Botellón',
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
  icons: {
    apple: [{ url: '/icon-192.png', sizes: '192x192' }],
  },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="manifest" href="/manifest" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-full flex flex-col">
        <SkipLink />
        {children}
        <PwaShell />
      </body>
    </html>
  );
}
