import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const failures = [];
const requireCondition = (condition, message) => {
  if (!condition) failures.push(message);
};

const configPath = "dist/server/wrangler.json";
requireCondition(existsSync(configPath), `${configPath} is missing; run npm run build first`);

if (existsSync(configPath)) {
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  requireCondition(config.main === "index.js", "Cloudflare build entrypoint must be index.js");
  requireCondition(config.assets?.directory === "../client", "Cloudflare static assets directory is not configured");
  requireCondition(config.compatibility_flags?.includes("nodejs_compat"), "nodejs_compat must be enabled");
  requireCondition(config.observability?.enabled === true, "Cloudflare observability must stay enabled");
  requireCondition((config.d1_databases ?? []).length === 0, "Production build must not contain legacy D1 bindings");
  requireCondition((config.r2_buckets ?? []).length === 0, "Production build must not contain legacy R2 bindings");
}

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);
const forbiddenTracked = tracked.filter((file) =>
  file === ".env" ||
  file.startsWith(".env.") ||
  file.startsWith("supabase/.temp/") ||
  file.startsWith(".wrangler/") ||
  file.startsWith("dist/") ||
  file.endsWith(".pem")
);
requireCondition(forbiddenTracked.length === 0, `Forbidden generated or secret files are tracked: ${forbiddenTracked.join(", ")}`);

const runtimeFiles = tracked.filter((file) =>
  file.startsWith("app/") || file.startsWith("lib/") || file.startsWith("scripts/") || file === "vite.config.ts"
);
const productionProjectRef = ["xpylzfdwud", "taceysfcwd"].join("");
const productionRefLeaks = runtimeFiles.filter((file) =>
  readFileSync(file, "utf8").includes(productionProjectRef)
);
requireCondition(productionRefLeaks.length === 0, `Production Supabase ref must not be hardcoded in runtime files: ${productionRefLeaks.join(", ")}`);

const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
requireCondition(workflow.includes("--name bot-studio-staging"), "CI deploy target must be the staging Worker");
requireCondition(workflow.includes("--strict"), "Cloudflare deploy must use Wrangler strict mode");
requireCondition(!/--name\s+bot-studio(?:\s|$)(?!-staging)/m.test(workflow), "CI must never deploy the production Worker");

if (failures.length) {
  for (const failure of failures) console.error(`ERROR: ${failure}`);
  process.exit(1);
}

console.log("PASS Cloudflare build contract: Vinext assets, nodejs_compat, observability, no D1/R2, no tracked secrets, staging-only CI deploy");
