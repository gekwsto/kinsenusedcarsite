"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, Star, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { FALLBACK_VEHICLE_IMAGE } from "@/lib/utils";

interface VehicleImageItem {
  id: string;
  url: string;
  alt: string | null;
  sortOrder: number;
  isMain: boolean;
}

interface VehicleImageManagerProps {
  vehicleId: string;
  images: VehicleImageItem[];
}

export function VehicleImageManager({ vehicleId, images }: VehicleImageManagerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [altText, setAltText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VehicleImageItem | null>(null);

  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast({ title: "Επιλέξτε αρχείο", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (altText) formData.append("alt", altText);
      if (sorted.length === 0) formData.append("isMain", "true");

      const res = await fetch(`/api/admin/vehicles/${vehicleId}/images`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Αποτυχία μεταφόρτωσης εικόνας");
      }
      toast({ title: "Η εικόνα ανέβηκε" });
      setAltText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Κάτι πήγε στραβά",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleSetMain(imageId: string) {
    setBusyId(imageId);
    try {
      const res = await fetch(`/api/admin/vehicles/${vehicleId}/images/${imageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isMain: true }),
      });
      if (!res.ok) throw new Error("Αποτυχία ενημέρωσης");
      toast({ title: "Ορίστηκε ως κύρια εικόνα" });
      router.refresh();
    } catch (error) {
      toast({ title: "Σφάλμα", description: String(error), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function handleReorder(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sorted.length) return;
    const next = [...sorted];
    [next[index], next[target]] = [next[target]!, next[index]!];
    const orderedImageIds = next.map((img) => img.id);

    setBusyId(sorted[index]!.id);
    try {
      const res = await fetch(`/api/admin/vehicles/${vehicleId}/images/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedImageIds }),
      });
      if (!res.ok) throw new Error("Αποτυχία αλλαγής σειράς");
      router.refresh();
    } catch (error) {
      toast({ title: "Σφάλμα", description: String(error), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    try {
      const res = await fetch(`/api/admin/vehicles/${vehicleId}/images/${pendingDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Αποτυχία διαγραφής εικόνας");
      toast({ title: "Η εικόνα διαγράφηκε" });
      router.refresh();
    } catch (error) {
      toast({ title: "Σφάλμα", description: String(error), variant: "destructive" });
    } finally {
      setBusyId(null);
      setPendingDelete(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {sorted.map((image, index) => (
          <div
            key={image.id}
            className={cn(
              "relative overflow-hidden rounded-card border border-border bg-white",
              busyId === image.id && "opacity-50",
            )}
          >
            <div className="relative aspect-[4/3] w-full bg-surface">
              <Image
                src={image.url || FALLBACK_VEHICLE_IMAGE}
                alt={image.alt ?? ""}
                fill
                className="object-cover"
                unoptimized
              />
              {image.isMain && (
                <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-white">
                  Κύρια
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-1 p-2">
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === 0 || busyId !== null}
                  onClick={() => handleReorder(index, -1)}
                  title="Μετακίνηση αριστερά/πάνω"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === sorted.length - 1 || busyId !== null}
                  onClick={() => handleReorder(index, 1)}
                  title="Μετακίνηση δεξιά/κάτω"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={image.isMain || busyId !== null}
                  onClick={() => handleSetMain(image.id)}
                  title="Ορισμός ως κύρια"
                >
                  <Star className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={busyId !== null}
                  onClick={() => setPendingDelete(image)}
                  title="Διαγραφή"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="col-span-full text-sm text-ink-muted">Δεν υπάρχουν εικόνες ακόμα.</p>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-card border border-dashed border-border p-4 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="image-file">Νέα εικόνα</Label>
          <Input id="image-file" type="file" accept="image/*" ref={fileInputRef} />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="image-alt">Alt text (προαιρετικό)</Label>
          <Input id="image-alt" value={altText} onChange={(e) => setAltText(e.target.value)} />
        </div>
        <Button type="button" onClick={handleUpload} disabled={uploading}>
          <UploadCloud className="h-4 w-4" />
          {uploading ? "Μεταφόρτωση…" : "Μεταφόρτωση"}
        </Button>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Διαγραφή εικόνας"
        description="Η εικόνα θα αφαιρεθεί οριστικά από το όχημα."
        destructive
        loading={busyId === pendingDelete?.id}
        onConfirm={handleDelete}
      />
    </div>
  );
}
