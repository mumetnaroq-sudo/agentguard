/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allow importing CommonJS modules
    esmExternals: 'loose'
  }
};

module.exports = nextConfig;
