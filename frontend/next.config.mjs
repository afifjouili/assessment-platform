/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure the sql.js WASM binary is bundled with all API routes on Vercel
  outputFileTracingIncludes: {
    '/api/**': ['./node_modules/sql.js/dist/sql-wasm.wasm'],
  },
  webpack: (config, { isServer }) => {
    // Allow WASM files to be bundled
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Exclude sql.js WASM from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    return config;
  },
};

export default nextConfig;
