"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/toaster";
import { NavigationTransitionProvider } from "@/components/providers/navigation-transition-provider";

// NavigationTransitionProvider is mounted exactly once, here, at the root —
// it owns the single shared navigation-loading overlay for the whole app.
// Do not mount a second instance anywhere else (header, layouts, pages).
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <NavigationTransitionProvider>{children}</NavigationTransitionProvider>
      <Toaster />
    </SessionProvider>
  );
}
