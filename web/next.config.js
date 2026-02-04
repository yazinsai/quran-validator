/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow importing from parent directory (quran-validator)
  transpilePackages: ['quran-validator'],
};

module.exports = nextConfig;
