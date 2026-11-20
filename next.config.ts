import type { NextConfig } from 'next';

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://api.ipify.org",
  "form-action 'self' https://payment.zarinpal.com https://sandbox.zarinpal.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: process.env.NODE_ENV === 'production' ? csp : csp.replace("script-src 'self'", "script-src 'self' 'unsafe-eval'") },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ],
    }, {
      source: '/covers/:file*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' }],
    }];
  },
};

export default config;
