import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tests/source-cloudflare/*.test.ts"] } });
