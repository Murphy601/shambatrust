import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Parent folder has a package-lock.json; pin Turbopack to this project
  // or `/` routes resolve against the wrong root and 404.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // pdfkit reads its AFM data and our embedded binder font from disk at runtime,
  // so these must stay outside the bundle.
  serverExternalPackages: ["pdfkit", "pdf-lib", "dejavu-fonts-ttf", "tesseract.js"],
  images: {
    // Cloudflare Workers deploy does not bind Cloudflare Images yet, so skip
    // the optimizer. Unsplash already serves sized assets.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
