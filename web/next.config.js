/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['quran-validator'],
};

module.exports = nextConfig;
