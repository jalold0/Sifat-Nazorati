/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // `output: 'standalone'` YOQILMAGAN: Windows'da pnpm bilan symlink (EPERM) xatosi beradi, ofis serveri esa
  // `next start` bilan ishlaydi. Sabab va muqobil: docs/JOYLASHTIRISH.md, «Yig'ma haqida».
  experimental: {
    // Server action'lar orqali katta reyestr importlari yuboriladi
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
