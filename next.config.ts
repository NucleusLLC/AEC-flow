import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Postgres driver (and Prisma adapter) out of the bundle so they run
  // as native Node modules — `pg` requires Node builtins like `dns`/`net`, which
  // a bundled (browser/edge) target can't resolve. Without this, any server page
  // importing the Prisma-backed data layer (e.g. Construction Admin) fails to
  // compile with "Module not found: Can't resolve 'dns'".
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "@prisma/client"],
  experimental: {
    // BETA-Report submits a downscaled JPEG screenshot inline with the form via a
    // Server Action. The default cap is 1MB; raise it so a busy screen still fits
    // (the widget also downscales + steps JPEG quality down to stay well under this).
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
