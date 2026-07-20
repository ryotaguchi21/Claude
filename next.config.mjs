/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // STATIC_EXPORT=1 のとき静的書き出し(Cloudflare Pages配信用)。通常はサーバーモード(Vercel/ローカル)
  ...(process.env.STATIC_EXPORT === "1" ? { output: "export" } : {}),
};

export default nextConfig;
