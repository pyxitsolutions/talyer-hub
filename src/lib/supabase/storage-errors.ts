export function mapStorageError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("bucket not found")) {
    return "Logo storage is not set up yet. Run supabase/migrations/004_shop_logos_storage.sql in the Supabase SQL Editor, then try again.";
  }

  if (
    lower.includes("row-level security") ||
    lower.includes("permission denied") ||
    lower.includes("not authorized")
  ) {
    return "Logo upload was blocked by storage permissions. Ask your admin to run migration 004_shop_logos_storage.sql in Supabase.";
  }

  return message;
}
