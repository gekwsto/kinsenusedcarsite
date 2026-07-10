"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/use-toast";

interface FavoritesContextValue {
  favoriteIds: Set<string>;
  isFavorite: (vehicleId: string) => boolean;
  toggle: (vehicleId: string) => Promise<void>;
  loading: boolean;
}

const FavoritesContext = React.createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const [favoriteIds, setFavoriteIds] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (status !== "authenticated") {
      // Intentional: clear the locally-cached favorite set on logout so a
      // previous user's hearts never leak into the next session.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFavoriteIds(new Set());
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch("/api/favorites/ids")
      .then((res) => (res.ok ? res.json() : { ids: [] }))
      .then((data: { ids: string[] }) => {
        if (!cancelled) setFavoriteIds(new Set(data.ids ?? []));
      })
      .catch(() => {
        if (!cancelled) setFavoriteIds(new Set());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  const isFavorite = React.useCallback((vehicleId: string) => favoriteIds.has(vehicleId), [favoriteIds]);

  const toggle = React.useCallback(
    async (vehicleId: string) => {
      if (status !== "authenticated") {
        toast({
          title: "Συνδεθείτε για να αποθηκεύσετε αγαπημένα",
          description: "Χρειάζεται σύνδεση για την προσθήκη οχημάτων στα αγαπημένα σας.",
        });
        router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      const wasFavorite = favoriteIds.has(vehicleId);

      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(vehicleId);
        else next.add(vehicleId);
        return next;
      });

      try {
        const res = await fetch("/api/favorites/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vehicleId }),
        });

        if (!res.ok) throw new Error("request_failed");

        const data: { favorited: boolean } = await res.json();
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (data.favorited) next.add(vehicleId);
          else next.delete(vehicleId);
          return next;
        });
      } catch {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorite) next.add(vehicleId);
          else next.delete(vehicleId);
          return next;
        });
        toast({
          title: "Κάτι πήγε στραβά",
          description: "Δεν ήταν δυνατή η ενημέρωση των αγαπημένων. Δοκιμάστε ξανά.",
          variant: "destructive",
        });
      }
    },
    [favoriteIds, status, router],
  );

  const value = React.useMemo(
    () => ({ favoriteIds, isFavorite, toggle, loading }),
    [favoriteIds, isFavorite, toggle, loading],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = React.useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within a FavoritesProvider");
  return ctx;
}
