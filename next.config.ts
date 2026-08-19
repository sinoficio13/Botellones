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
// Applied to production only: serwist injects a webpack config, which
// Next 16.3 rejects under Turbopack (the dev default). Production builds
// run with `next build --webpack` so the worker compiles to public/sw.js.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  register: false,
});

export default process.env.NODE_ENV === "production"
  ? withSerwist(nextConfig)
  : nextConfig;
