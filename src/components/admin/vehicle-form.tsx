"use client";

import { useState } from "react";
import { useForm, Controller, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { vehicleAdminSchema, type VehicleAdminInput } from "@/lib/validators/vehicle.schema";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";

interface VehicleFormProps {
  mode: "create" | "edit";
  vehicleId?: string;
  slug?: string;
  defaultValues?: Partial<VehicleAdminInput>;
}

type FormValues = VehicleAdminInput;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-600">{message}</p>;
}

export function VehicleForm({ mode, vehicleId, slug, defaultValues }: VehicleFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [featuresText, setFeaturesText] = useState((defaultValues?.features ?? []).join("\n"));

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(vehicleAdminSchema),
    defaultValues: {
      offer: false,
      froze: false,
      isDeleted: false,
      features: [],
      ...defaultValues,
    },
  });

  const numberField = (name: Path<FormValues>) =>
    register(name, { setValueAs: (v) => (v === "" || v === null ? undefined : v) });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const url = mode === "create" ? "/api/admin/vehicles" : `/api/admin/vehicles/${vehicleId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Αποτυχία αποθήκευσης οχήματος");
      }
      const vehicle = await res.json();
      toast({ title: "Επιτυχία", description: "Το όχημα αποθηκεύτηκε." });
      if (mode === "create") {
        router.push(`/admin/vehicles/${vehicle.id}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Κάτι πήγε στραβά",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Βασικά Στοιχεία</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="maker">Κατασκευαστής *</Label>
            <Input id="maker" {...register("maker")} />
            <FieldError message={errors.maker?.message} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="model">Μοντέλο *</Label>
            <Input id="model" {...register("model")} />
            <FieldError message={errors.model?.message} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="yearRelease">Έτος</Label>
            <Input id="yearRelease" type="number" {...numberField("yearRelease")} />
            <FieldError message={errors.yearRelease?.message} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="externalCarId">External Car ID</Label>
            <Input id="externalCarId" {...register("externalCarId")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plate">Πινακίδα</Label>
            <Input id="plate" {...register("plate")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vin">VIN</Label>
            <Input id="vin" {...register("vin")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Slug</Label>
            <Input value={slug ?? "Θα δημιουργηθεί αυτόματα"} disabled readOnly />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Τιμές & Χιλιόμετρα</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="price">Τιμή (€)</Label>
            <Input id="price" type="number" step="0.01" {...numberField("price")} />
            <FieldError message={errors.price?.message} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="monthlyPrice">Μηνιαία Δόση (€)</Label>
            <Input id="monthlyPrice" type="number" step="0.01" {...numberField("monthlyPrice")} />
            <FieldError message={errors.monthlyPrice?.message} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="km">Χιλιόμετρα</Label>
            <Input id="km" type="number" {...numberField("km")} />
            <FieldError message={errors.km?.message} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Τεχνικά Χαρακτηριστικά</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cc">Κυβικά (cc)</Label>
            <Input id="cc" type="number" {...numberField("cc")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hp">Ιπποδύναμη (hp)</Label>
            <Input id="hp" type="number" {...numberField("hp")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fuel">Καύσιμο</Label>
            <Input id="fuel" {...register("fuel")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="transmissionType">Κιβώτιο Ταχυτήτων</Label>
            <Input id="transmissionType" {...register("transmissionType")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="color">Χρώμα</Label>
            <Input id="color" {...register("color")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="typeOfCar">Τύπος Οχήματος</Label>
            <Input id="typeOfCar" {...register("typeOfCar")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Κατάσταση</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-8">
          <Controller
            control={control}
            name="offer"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm text-ink">
                <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                Προσφορά
              </label>
            )}
          />
          <Controller
            control={control}
            name="froze"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm text-ink">
                <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                Παγωμένο (μη ορατό στο κοινό)
              </label>
            )}
          />
          <Controller
            control={control}
            name="isDeleted"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm text-ink">
                <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                Διαγραμμένο (αρχειοθετημένο)
              </label>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Περιγραφή & Χαρακτηριστικά</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Περιγραφή</Label>
            <Textarea id="description" rows={5} {...register("description")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="features">Χαρακτηριστικά (ένα ανά γραμμή)</Label>
            <Textarea
              id="features"
              rows={5}
              value={featuresText}
              onChange={(e) => {
                setFeaturesText(e.target.value);
                setValue(
                  "features",
                  e.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean),
                );
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SEO</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="seoTitle">SEO Title</Label>
            <Input id="seoTitle" {...register("seoTitle")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="seoDescription">SEO Description</Label>
            <Textarea id="seoDescription" rows={3} {...register("seoDescription")} />
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
          Ακύρωση
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Αποθήκευση…" : mode === "create" ? "Δημιουργία Οχήματος" : "Αποθήκευση Αλλαγών"}
        </Button>
      </div>
    </form>
  );
}
