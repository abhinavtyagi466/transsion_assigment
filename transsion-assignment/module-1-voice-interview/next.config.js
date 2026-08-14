/** @type {import('next').NextConfig} */
const nextConfig = {
  // Rewrite all /api/* calls to the local uvicorn FastAPI server (port 8000)
  // This keeps frontend code using relative /api/... paths in both local dev
  // and production (Vercel handles routing in prod via vercel.json).
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
