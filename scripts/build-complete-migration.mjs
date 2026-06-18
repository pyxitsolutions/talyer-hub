import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");
const outputPath = path.join(root, "supabase", "complete_schema.sql");

const files = fs
  .readdirSync(migrationsDir)
  .filter((name) => /^0(0[1-9]|1[0-8])_/.test(name))
  .sort();

const header = `-- =============================================================================
-- TalyerHub — Complete database setup (fresh Supabase project)
-- =============================================================================
-- Run this ONCE in Supabase → SQL Editor on a NEW empty project.
-- Combines migrations 001 through 018 (excludes 019_shop_trial — manual billing).
--
-- Do NOT run if you already applied the individual migration files (duplicate errors).
-- Do NOT run on production with existing data unless you know what you are doing.
--
-- After this file succeeds:
--   1. Authentication → Email ON, Confirm email OFF
--   2. Set Site URL + redirect URLs (see DEPLOYMENT.md)
--   3. Promote super admin (SQL in DEPLOYMENT.md)
-- =============================================================================

`;

let body = "";

for (const file of files) {
  body += `\n-- ----------------------------------------------------------------------------- \n`;
  body += `-- ${file}\n`;
  body += `-- ----------------------------------------------------------------------------- \n\n`;
  body += fs.readFileSync(path.join(migrationsDir, file), "utf8").trimEnd();
  body += "\n\n";
}

fs.writeFileSync(outputPath, header + body);
console.log(`Wrote ${outputPath} (${files.length} migrations)`);
