/** @type {import('next').NextConfig} */
const serverActionOrigins = [
  "localhost:3000",
  "127.0.0.1:3000",
  "app:3000",
  ...(process.env.SERVER_ACTION_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
];

const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: serverActionOrigins
    }
  }
};

export default nextConfig;
