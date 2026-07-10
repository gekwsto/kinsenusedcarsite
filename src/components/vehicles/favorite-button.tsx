"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/components/providers/favorites-provider";

interface FavoriteButtonProps {
  vehicleId: string;
  className?: string;
  size?: "sm" | "md";
}

export function FavoriteButton({ vehicleId, className, size = "md" }: FavoriteButtonProps) {
  const { isFavorite, toggle } = useFavorites();
  const [pending, setPending] = React.useState(false);
  const active = isFavorite(vehicleId);

  const handleClick = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (pending) return;
    setPending(true);
    try {
      await toggle(vehicleId);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      aria-label={active ? "Αφαίρεση από τα αγαπημένα" : "Προσθήκη στα αγαπημένα"}
      disabled={pending}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-white/90 shadow-soft backdrop-blur transition-transform hover:scale-105 disabled:opacity-60",
        size === "sm" ? "h-8 w-8" : "h-10 w-10",
        className,
      )}
    >
      <Heart
        className={cn(
          size === "sm" ? "h-4 w-4" : "h-5 w-5",
          active ? "fill-favorite-active text-favorite-active" : "text-favorite-inactive",
        )}
      />
    </button>
  );
}
