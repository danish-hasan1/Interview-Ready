import { routes, type VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  // One FastAPI function (api/index.py) serves every /api/* route.
  rewrites: [routes.rewrite("/api/(.*)", "/api/index")],
  functions: {
    "api/index.py": { maxDuration: 60, memory: 1024 },
  },
};
