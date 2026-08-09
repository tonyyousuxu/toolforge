/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Tell Next.js to transpile pdfjs-dist so webpack can process its ESM
  // modules correctly (avoids "Object.defineProperty called on non-object").
  transpilePackages: ['pdfjs-dist'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  webpack: (config) => {
    // pdfjs-dist v5 ships .mjs files; ensure webpack treats them as ESM.
    config.resolve.extensionAlias = {
      '.mjs': ['.mjs'],
      '.js': ['.js', '.mjs'],
    };
    return config;
  },
  experimental: {
    // Expansion slots for future features
    // turbo: {},
    // ppr: true,
  },
};

export default nextConfig;
