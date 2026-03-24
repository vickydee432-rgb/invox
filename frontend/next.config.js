const path = require("path");

/** @type {import('next').NextConfig} */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "script-src 'self' 'unsafe-inline' https://checkout.dodopayments.com https://test.checkout.dodopayments.com https://unpkg.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https: wss:",
  "frame-src https://checkout.dodopayments.com https://test.checkout.dodopayments.com"
].join("; ");

const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: path.join(__dirname)
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }
        ]
      }
    ];
  },
  async redirects() {
    const mongoId = "([0-9a-fA-F]{24})";
    return [
      { source: `/expenses/:id${mongoId}`, destination: "/expenses/:id/edit", permanent: false },
      { source: `/sales/:id${mongoId}`, destination: "/sales/:id/edit", permanent: false },
      { source: `/quotes/:id${mongoId}`, destination: "/quotes/:id/edit", permanent: false },
      { source: `/invoices/:id${mongoId}`, destination: "/invoices/:id/receipt", permanent: false }
    ];
  }
};

module.exports = nextConfig;
