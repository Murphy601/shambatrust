import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // In-memory cache is enough for the first Workers deploy. Bind R2 later:
  // https://opennext.js.org/cloudflare/caching
});
