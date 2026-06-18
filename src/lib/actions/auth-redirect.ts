"use server";

import { getAuthRedirectPath } from "@/lib/auth";

export async function resolveAuthRedirectPath(): Promise<string> {
  return getAuthRedirectPath();
}
