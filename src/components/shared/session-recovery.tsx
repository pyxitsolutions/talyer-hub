"use client";

import { Loader2 } from "lucide-react";
import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

export function SessionRecovery() {
  useEffect(() => {
    async function recover() {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/login";
    }

    void recover();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      Resetting session...
    </div>
  );
}
