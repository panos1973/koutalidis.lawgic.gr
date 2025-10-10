import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
    instrumentationHook: true,
    serverComponentsExternalPackages: ["tesseract.js"],
    outputFileTracingIncludes: {
      "/api/**/*": ["./node_modules/**/*.wasm", "./node_modules/**/*.proto"],
    },
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    return config;
  },
};

export default withNextIntl(nextConfig);
