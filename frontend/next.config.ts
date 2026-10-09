import type { NextConfig } from "next";

import path from "path";

const nextConfig: NextConfig = {
  basePath: "/jigfixtures",
  trailingSlash: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
