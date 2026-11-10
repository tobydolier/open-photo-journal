#!/usr/bin/env node
// Deploy only the standalone FrameFeed artifact. Fail closed if the build used
// placeholder ChatGPT Sites resources or the expected Worker was not produced.
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
const configPath = "dist/framefeed/wrangler.json";
if (!existsSync(configPath)) {
  console.error("FrameFeed build output missing: " + configPath + ". Build with FRAMEFEED_DEPLOY=1 pnpm run build first.");
  process.exit(1);
}
const cfg = JSON.parse(readFileSync(configPath, "utf8"));
const d1 = (cfg.d1_databases ?? []).find(x => x.binding === "DB");
const r2 = (cfg.r2_buckets ?? []).find(x => x.binding === "BUCKET");
if (cfg.name !== "framefeed" ||
    d1?.database_id !== "2d43ec6a-9a00-425e-8497-2495a55f2d65" ||
    d1?.database_name !== "framefeed-db" ||
    r2?.bucket_name !== "framefeed-media") {
  console.error("Refusing to deploy: generated Worker name or D1/R2 bindings do not match FrameFeed.");
  process.exit(1);
}
const result = spawnSync("pnpm", ["exec", "wrangler", "deploy", "--config", configPath], { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
