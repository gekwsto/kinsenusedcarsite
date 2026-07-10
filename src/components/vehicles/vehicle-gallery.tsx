"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const FALLBACK_IMAGE = "/images/vehicle-fallback.png";

interface GalleryImage {
  id: string;
  url: string;
  alt?: string | null;
}

export function VehicleGallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const items = images.length > 0 ? images : [{ id: "fallback", url: FALLBACK_IMAGE, alt: title }];
  const [activeIndex, setActiveIndex] = React.useState(0);

  const goTo = React.useCallback(
    (index: number) => setActiveIndex((index + items.length) % items.length),
    [items.length],
  );
  const activeImage = (items[activeIndex] ?? items[0])!;

  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goTo(activeIndex + 1);
      if (e.key === "ArrowLeft") goTo(activeIndex - 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeIndex, goTo]);

  return (
    <div className="mx-auto w-full max-w-[1200px] overflow-hidden rounded-3xl shadow-[0_18px_35px_rgba(0,0,0,0.08)]">
      <div className="relative h-[400px] w-full bg-white sm:h-[500px] lg:h-[650px]">
        <Image
          src={activeImage.url}
          alt={activeImage.alt ?? title}
          fill
          priority
          sizes="(min-width: 1024px) 1200px, 100vw"
          className="object-contain"
        />

        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(activeIndex - 1)}
              aria-label="Προηγούμενη εικόνα"
              className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-soft hover:bg-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => goTo(activeIndex + 1)}
              aria-label="Επόμενη εικόνα"
              className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-soft hover:bg-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
              {items.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Εικόνα ${index + 1}`}
                  className={cn(
                    "h-2.5 w-2.5 rounded-full transition-colors",
                    index === activeIndex ? "bg-detail" : "bg-ink-muted/40",
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
