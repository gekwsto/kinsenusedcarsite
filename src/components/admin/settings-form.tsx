"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SiteSettings } from "@/server/services/settings.service";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";

interface SettingsFormProps {
  initialSettings: SiteSettings;
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState({
    contactEmail: initialSettings.contactEmail,
    contactPhone: initialSettings.contactPhone,
    address: initialSettings.address,
    facebook: initialSettings.socialLinks.facebook ?? "",
    instagram: initialSettings.socialLinks.instagram ?? "",
    linkedin: initialSettings.socialLinks.linkedin ?? "",
    fallbackVehicleImage: initialSettings.fallbackVehicleImage,
    featuredVehicleIds: initialSettings.featuredVehicleIds.join(", "),
  });

  function update<K extends keyof typeof values>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        contactEmail: values.contactEmail,
        contactPhone: values.contactPhone,
        address: values.address,
        socialLinks: {
          facebook: values.facebook || undefined,
          instagram: values.instagram || undefined,
          linkedin: values.linkedin || undefined,
        },
        fallbackVehicleImage: values.fallbackVehicleImage,
        featuredVehicleIds: values.featuredVehicleIds
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      };

      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Αποτυχία αποθήκευσης ρυθμίσεων");
      }
      toast({ title: "Οι ρυθμίσεις αποθηκεύτηκαν" });
      router.refresh();
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Κάτι πήγε στραβά",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Στοιχεία Επικοινωνίας</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contactEmail">Email Επικοινωνίας</Label>
            <Input
              id="contactEmail"
              type="email"
              value={values.contactEmail}
              onChange={(e) => update("contactEmail", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contactPhone">Τηλέφωνο Επικοινωνίας</Label>
            <Input
              id="contactPhone"
              value={values.contactPhone}
              onChange={(e) => update("contactPhone", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="address">Διεύθυνση</Label>
            <Input id="address" value={values.address} onChange={(e) => update("address", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Κοινωνικά Δίκτυα</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="facebook">Facebook</Label>
            <Input id="facebook" value={values.facebook} onChange={(e) => update("facebook", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="instagram">Instagram</Label>
            <Input id="instagram" value={values.instagram} onChange={(e) => update("instagram", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="linkedin">LinkedIn</Label>
            <Input id="linkedin" value={values.linkedin} onChange={(e) => update("linkedin", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Οχήματα</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fallbackVehicleImage">Εικόνα Fallback Οχήματος (path)</Label>
            <Input
              id="fallbackVehicleImage"
              value={values.fallbackVehicleImage}
              onChange={(e) => update("fallbackVehicleImage", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="featuredVehicleIds">Προτεινόμενα Οχήματα (IDs, χωρισμένα με κόμμα)</Label>
            <Input
              id="featuredVehicleIds"
              value={values.featuredVehicleIds}
              onChange={(e) => update("featuredVehicleIds", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ενσωματώσεις (μόνο μέσω Environment Variables)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-ink-muted">
          <p>
            Το API key για την ενσωμάτωση CarStock ρυθμίζεται μέσω της μεταβλητής περιβάλλοντος{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 text-ink">CARSTOCK_API_KEY</code> και δεν είναι
            επεξεργάσιμο από εδώ.
          </p>
          <p>
            Οι ρυθμίσεις SMTP (αποστολή email) ρυθμίζονται επίσης μέσω environment variables στον server και
            δεν διαχειρίζονται από αυτή τη σελίδα.
          </p>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Αποθήκευση…" : "Αποθήκευση Ρυθμίσεων"}
        </Button>
      </div>
    </form>
  );
}
