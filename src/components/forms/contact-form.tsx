"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createContactMessageSchema, type CreateContactMessageInput } from "@/lib/validators/contact.schema";

export function ContactForm() {
  const [status, setStatus] = React.useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateContactMessageInput>({
    resolver: zodResolver(createContactMessageSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      message: "",
      consent: true,
      honeypot: "",
    },
  });

  const onSubmit = async (values: CreateContactMessageInput) => {
    setStatus("submitting");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/contact", {
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
    } catch {
      setStatus("error");
      setErrorMessage("Δεν ήταν δυνατή η αποστολή. Ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.");
    }
  };

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <h2 className="text-lg font-semibold text-ink">Ευχαριστούμε για το μήνυμά σας!</h2>
        <p className="text-sm text-ink-muted">Η ομάδα μας θα επικοινωνήσει μαζί σας το συντομότερο δυνατό.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input type="text" {...register("honeypot")} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="first-name">Όνομα</Label>
          <Input id="first-name" {...register("firstName")} />
          {errors.firstName && <p className="text-xs text-red-600">{errors.firstName.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last-name">Επώνυμο</Label>
          <Input id="last-name" {...register("lastName")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...register("email")} />
        {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message">Μήνυμα</Label>
        <Textarea id="message" rows={6} {...register("message")} />
        {errors.message && <p className="text-xs text-red-600">{errors.message.message}</p>}
      </div>

      {status === "error" && errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <Button
        type="submit"
        className="rounded-full bg-footer px-10 py-3 font-semibold text-white hover:bg-accent hover:text-footer"
        disabled={status === "submitting"}
      >
        {status === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Αποστολή
      </Button>
    </form>
  );
}
