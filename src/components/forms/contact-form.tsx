"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, MessageSquare, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KINSEN_CTA_BUTTON_CLASSNAME } from "@/components/ui/kinsen-cta-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { createContactMessageSchema, type CreateContactMessageInput } from "@/lib/validators/contact.schema";
import { cn } from "@/lib/utils";

// Shared soft-outline field treatment — the same premium-minimal language as
// the redesigned Login form (thin muted border, soft radius, a quiet
// border-color-only focus state instead of a loud colored ring). Kept as one
// constant rather than a new abstraction so every field here stays visually
// identical without repeating the same long class string four times.
const CONTACT_FIELD_CLASSNAME =
  "rounded-xl border-border/70 bg-white pl-10 text-[15px] shadow-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/15";

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
      <Card className="rounded-2xl border-border/60 bg-white shadow-card">
        <CardContent className="flex flex-col items-center gap-3 p-6 py-14 text-center sm:p-8 sm:py-16">
          <h2 className="text-lg font-semibold text-ink">Ευχαριστούμε για το μήνυμά σας!</h2>
          <p className="text-sm text-ink-muted">Η ομάδα μας θα επικοινωνήσει μαζί σας το συντομότερο δυνατό.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-border/60 bg-white shadow-card">
      {/* `lg:` values only tighten the desktop/laptop rhythm a touch
          further, so the card's total height lines up with the left
          image's natural aspect-ratio height at those widths — tablet and
          mobile keep their existing (untouched) padding/gaps. */}
      <CardContent className="p-6 sm:p-7 lg:p-7">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 lg:space-y-3.5">
          <input type="text" {...register("honeypot")} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="first-name">Όνομα</Label>
              <div className="group relative">
                <User
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted/70 transition-colors group-focus-within:text-primary"
                />
                <Input
                  id="first-name"
                  placeholder="Το όνομά σας"
                  className={cn(CONTACT_FIELD_CLASSNAME, "h-12")}
                  {...register("firstName")}
                />
              </div>
              {errors.firstName && <p className="text-xs text-red-600">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="last-name">Επώνυμο</Label>
              <div className="group relative">
                <User
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted/70 transition-colors group-focus-within:text-primary"
                />
                <Input
                  id="last-name"
                  placeholder="Το επώνυμό σας"
                  className={cn(CONTACT_FIELD_CLASSNAME, "h-12")}
                  {...register("lastName")}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <div className="group relative">
              <Mail
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted/70 transition-colors group-focus-within:text-primary"
              />
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                className={cn(CONTACT_FIELD_CLASSNAME, "h-12")}
                {...register("email")}
              />
            </div>
            {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="message">Μήνυμα</Label>
            <div className="group relative">
              <MessageSquare
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-ink-muted/70 transition-colors group-focus-within:text-primary"
              />
              {/* Shorter than the original 6-row textarea — tall enough to
                  stay genuinely useful for a real message, but this was the
                  single biggest contributor to the form panel reading much
                  taller than the left-side image; trimming it is what lets
                  the two columns balance. */}
              <Textarea
                id="message"
                rows={4}
                placeholder="Πώς μπορούμε να σας βοηθήσουμε;"
                // `lg:h-[100px]` is a small desktop-only trim on top of the
                // `rows={4}` natural size (tablet/mobile keep that natural
                // sizing untouched) — one of the last few px needed to line
                // the card's bottom edge up with the image's.
                className={cn(CONTACT_FIELD_CLASSNAME, "min-h-[104px] py-3 lg:h-[100px]")}
                {...register("message")}
              />
            </div>
            {errors.message && <p className="text-xs text-red-600">{errors.message.message}</p>}
          </div>

          {status === "error" && errorMessage ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">{errorMessage}</p>
          ) : null}

          {/* Same static Kinsen corporate CTA as the Login/Navbar "Σύνδεση"
              action (see kinsen-cta-button.tsx) — reused as-is, no new
              button styling introduced. Full-width at every size gives it
              real visual presence against the left-side image instead of
              the old small rounded-full pill. */}
          <Button
            type="submit"
            variant="primary"
            className={cn(KINSEN_CTA_BUTTON_CLASSNAME, "h-12 w-full rounded-xl")}
            disabled={status === "submitting"}
          >
            {status === "submitting" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            Αποστολή
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
