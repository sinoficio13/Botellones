import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.10.12', '192.168.*', 'localhost'],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
    ];
  },
};

// Serwist PWA wrapper. `register: false` keeps registration manual via
// update-prompt.tsx (avoids the dev-mode /sw.js 404 breaking the page).
// `disable: NODE_ENV === 'production'` keeps the PWA out of the production
// build for now: Serwist's webpack output breaks Vercel's route-group file
// upload (lstat ENOENT on `(dashboard)/page_client-reference-manifest.js`).
// Reintroduce the production PWA with @serwist/turbopack when Next 16 +
// Vercel accept the webpack output.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  register: false,
  disable: process.env.NODE_ENV === "production",
});

export default process.env.NODE_ENV === "production"
  ? withSerwist(nextConfig)
  : nextConfig;
