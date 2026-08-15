import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Parent folder has a package-lock.json; pin Turbopack to this project
  // or `/` routes resolve against the wrong root and 404.
  turbopack: {
    root: path.resolve(__dirname),
  },
  serverExternalPackages: ["pdfkit", "pdf-lib"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
