"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { createLeadSchema, type CreateLeadInput } from "@/lib/validators/lead.schema";

const INTEREST_LABELS: Record<CreateLeadInput["interestType"], string> = {
  LEASING: "Ενδιαφέρον για Leasing",
  FINANCING: "Ενδιαφέρον για Δανειοδότηση",
  TEST_DRIVE: "Κράτηση Test Drive",
  GENERAL: "Ερώτηση για το όχημα",
};

interface InterestModalProps {
  trigger: React.ReactNode;
  interestType: CreateLeadInput["interestType"];
  vehicleId?: string;
  vehicleLabel?: string;
}

export function InterestModal({ trigger, interestType, vehicleId, vehicleLabel }: InterestModalProps) {
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateLeadInput>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      message: "",
      interestType,
      vehicleId,
      consent: undefined,
      honeypot: "",
    },
  });

  const consent = watch("consent");

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setStatus("idle");
      setErrorMessage(null);
      reset({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        message: "",
        interestType,
        vehicleId,
        consent: undefined,
        honeypot: "",
      });
    }
  };

  const onSubmit = async (values: CreateLeadInput) => {
    setStatus("submitting");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (res.status === 429) {
        setStatus("error");
        setErrorMessage("Έχετε υποβάλει πολλά αιτήματα. Δοκιμάστε ξανά σε λίγο.");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setStatus("error");
        setErrorMessage(data?.error ?? "Κάτι πήγε στραβά. Δοκιμάστε ξανά.");
        return;
      }

      setStatus("success");
      toast({
        title: "Το αίτημά σας εστάλη!",
        description: "Ένας σύμβουλός μας θα επικοινωνήσει μαζί σας σύντομα.",
        variant: "success",
      });
      setTimeout(() => handleOpenChange(false), 1200);
    } catch {
      setStatus("error");
      setErrorMessage("Δεν ήταν δυνατή η αποστολή. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{INTEREST_LABELS[interestType]}</DialogTitle>
          <DialogDescription>
            {vehicleLabel ? `Για το όχημα: ${vehicleLabel}. ` : ""}Συμπληρώστε τα στοιχεία σας και θα επικοινωνήσουμε
            μαζί σας το συντομότερο.
          </DialogDescription>
        </DialogHeader>

        {status === "success" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-accent" />
            <p className="font-medium text-ink">Ευχαριστούμε για το ενδιαφέρον σας!</p>
            <p className="text-sm text-ink-muted">Θα επικοινωνήσουμε μαζί σας σύντομα.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <input
              type="text"
              {...register("honeypot")}
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="im-firstName">Όνομα</Label>
                <Input id="im-firstName" {...register("firstName")} />
                {errors.firstName && <p className="text-xs text-red-600">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="im-lastName">Επώνυμο</Label>
                <Input id="im-lastName" {...register("lastName")} />
                {errors.lastName && <p className="text-xs text-red-600">{errors.lastName.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="im-email">Email</Label>
              <Input id="im-email" type="email" {...register("email")} />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="im-phone">Τηλέφωνο (προαιρετικό)</Label>
              <Input id="im-phone" type="tel" {...register("phone")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="im-message">Μήνυμα (προαιρετικό)</Label>
              <Textarea id="im-message" rows={3} {...register("message")} />
            </div>

            <div className="flex items-start gap-2.5">
              <Checkbox
                id="im-consent"
                checked={consent === true}
                onCheckedChange={(checked) => setValue("consent", checked === true ? true : (undefined as never))}
              />
              <Label htmlFor="im-consent" className="text-sm font-normal text-ink-muted">
                Συμφωνώ με την{" "}
                <a href="#" className="text-primary underline-offset-2 hover:underline">
                  πολιτική απορρήτου
                </a>
                .
              </Label>
            </div>
            {errors.consent && <p className="text-xs text-red-600">{errors.consent.message}</p>}

            {status === "error" && errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

            <Button type="submit" variant="accent" className="w-full" disabled={status === "submitting"}>
              {status === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Αποστολή αιτήματος
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
