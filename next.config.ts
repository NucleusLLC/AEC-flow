import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Postgres driver (and Prisma adapter) out of the bundle so they run
  // as native Node modules — `pg` requires Node builtins like `dns`/`net`, which
  // a bundled (browser/edge) target can't resolve. Without this, any server page
  // importing the Prisma-backed data layer (e.g. Construction Admin) fails to
  // compile with "Module not found: Can't resolve 'dns'".
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "@prisma/client"],
};

export default nextConfig;
