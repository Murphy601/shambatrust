import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default {
  ...defineCloudflareConfig({
    // In-memory cache is enough for the first Workers deploy. Bind R2 later:
    // https://opennext.js.org/cloudflare/caching
  }),
  // Cloudflare Workers Builds runs `npm run build`, which we map to OpenNext.
  // OpenNext would otherwise call `npm run build` again and recurse, so Next
  // itself is invoked here directly.
  buildCommand: "npx next build",
};
