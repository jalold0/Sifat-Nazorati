/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Server action'lar orqali katta reyestr importlari yuboriladi
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
