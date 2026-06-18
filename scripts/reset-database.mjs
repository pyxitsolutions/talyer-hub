/**
 * Full database reset: auth accounts + all shop/business data.
 * Optionally creates a platform super admin when env vars are set.
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional super admin (created after wipe):
 *   SUPER_ADMIN_EMAIL
 *   SUPER_ADMIN_PASSWORD   (min 8 chars)
 *   SUPER_ADMIN_NAME       (optional)
 *
 * Usage:
 *   npm run db:reset
 *   npm run db:fresh-start
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvFile(name) {
  const path = resolve(root, name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const authHeaders = {
  Authorization: `Bearer ${serviceRoleKey}`,
  apikey: serviceRoleKey,
};

const restHeaders = {
  ...authHeaders,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

async function authRequest(path, options = {}) {
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      ...authHeaders,
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    throw new Error(
      typeof body === "object" && body?.message
        ? body.message
        : `${response.status} ${response.statusText}`
    );
  }

  return body;
}

async function restRequest(path, options = {}) {
  const response = await fetch(`${url}/rest/v1${path}`, {
    ...options,
    headers: {
      ...restHeaders,
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `${response.status} ${response.statusText}`);
  }

  return text ? JSON.parse(text) : null;
}

async function deleteAllAuthUsers() {
  let page = 1;
  let totalDeleted = 0;

  while (true) {
    const data = await authRequest(`/auth/v1/admin/users?page=${page}&per_page=100`);
    const users = data?.users ?? [];
    if (users.length === 0) break;

    for (const user of users) {
      await authRequest(`/auth/v1/admin/users/${user.id}`, { method: "DELETE" });
      totalDeleted += 1;
      console.log(`  deleted account: ${user.email ?? user.id}`);
    }

    if (users.length < 100) break;
    page += 1;
  }

  return totalDeleted;
}

async function runSqlReset() {
  await restRequest("/user_roles?id=neq.00000000-0000-0000-0000-000000000000", {
    method: "DELETE",
  });

  await restRequest("/shops?id=neq.00000000-0000-0000-0000-000000000000", {
    method: "DELETE",
  });

  const roles = [
    {
      id: "a0000000-0000-0000-0000-000000000001",
      name: "owner",
      description: "Shop owner with full access",
    },
    {
      id: "a0000000-0000-0000-0000-000000000002",
      name: "service_advisor",
      description: "Service advisor managing estimates and customers",
    },
    {
      id: "a0000000-0000-0000-0000-000000000003",
      name: "technician",
      description: "Technician performing repairs",
    },
    {
      id: "a0000000-0000-0000-0000-000000000004",
      name: "cashier",
      description: "Cashier handling billing and payments",
    },
    {
      id: "a0000000-0000-0000-0000-000000000005",
      name: "super_admin",
      description: "Platform administrator with cross-shop access",
    },
  ];

  await restRequest("/roles?on_conflict=name", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(roles),
  });
}

async function clearShopLogos() {
  const response = await fetch(`${url}/storage/v1/object/list/shop-logos`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prefix: "",
      limit: 1000,
      offset: 0,
    }),
  });

  if (!response.ok) {
    console.warn(`  storage warning: ${response.status} ${response.statusText}`);
    return 0;
  }

  const files = await response.json();
  if (!Array.isArray(files) || files.length === 0) return 0;

  const paths = files.map((file) => file.name);
  const removeResponse = await fetch(`${url}/storage/v1/object/shop-logos`, {
    method: "DELETE",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes: paths }),
  });

  if (!removeResponse.ok) {
    console.warn(`  storage remove warning: ${removeResponse.status} ${removeResponse.statusText}`);
    return 0;
  }

  return paths.length;
}

async function createSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const fullName = process.env.SUPER_ADMIN_NAME?.trim() || "TalyerHub Admin";

  if (!email || !password) {
    console.log(
      "4) Super admin skipped. Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in .env.local"
    );
    console.log("   Or run: npm run db:fresh-start\n");
    return null;
  }

  if (password.length < 8) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 8 characters");
  }

  console.log("4) Creating platform super admin...");
  const created = await authRequest("/auth/v1/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    }),
  });

  const userId = created?.id ?? created?.user?.id;
  if (!userId) {
    throw new Error("Failed to create super admin auth user");
  }

  await restRequest("/profiles", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      id: userId,
      shop_id: null,
      full_name: fullName,
      email,
      is_active: true,
      is_super_admin: true,
    }),
  });

  console.log(`   Super admin created: ${email}`);
  console.log("   Sign in at /login → Platform Admin\n");
  return email;
}

async function main() {
  console.log("TalyerHub — full database reset\n");
  console.log("WARNING: This deletes ALL shops, business data, and login accounts.\n");

  console.log("1) Clearing shops, business data, and re-seeding roles...");
  await runSqlReset();
  console.log("   Shops and linked data cleared.\n");

  console.log("2) Deleting auth accounts...");
  const deletedUsers = await deleteAllAuthUsers();
  console.log(`   ${deletedUsers} account(s) removed.\n`);

  console.log("3) Clearing shop logo uploads...");
  const removedFiles = await clearShopLogos();
  console.log(`   ${removedFiles} storage file(s) removed.\n`);

  const superAdminEmail = await createSuperAdmin();

  console.log("Done. Database is clean.");
  if (superAdminEmail) {
    console.log(`Next step: sign in as ${superAdminEmail} at /login`);
  } else {
    console.log("Next steps:");
    console.log("  • Register again at /register");
    console.log("  • Or set SUPER_ADMIN_* in .env.local and run npm run db:reset again");
  }
}

main().catch((err) => {
  console.error("\nReset failed:", err.message ?? err);
  process.exit(1);
});
