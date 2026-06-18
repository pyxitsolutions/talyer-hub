"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  clearSessionQueryCache,
  resetTenantQueryCache,
} from "@/lib/query/session-cache";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

function AuthQuerySync() {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearSessionQueryCache(queryClient);
        return;
      }

      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        resetTenantQueryCache(queryClient);
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  return null;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthQuerySync />
      {children}
    </QueryClientProvider>
  );
}
