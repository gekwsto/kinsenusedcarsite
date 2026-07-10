"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { registerSchema, type RegisterInput } from "@/lib/validators/auth.schema";
import { registerAction } from "@/app/(public)/register/actions";

export function RegisterForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      consent: undefined,
    },
  });

  const consent = watch("consent");

  const onSubmit = async (values: RegisterInput) => {
    setSubmitting(true);
    setError(null);

    const result = await registerAction(values);

    if (!result.ok) {
      setSubmitting(false);
      setError(result.error);
      return;
    }

    router.push("/login?registered=1");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-card border border-border bg-white p-6 shadow-soft">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="register-firstName">Όνομα</Label>
          <Input id="register-firstName" {...register("firstName")} />
          {errors.firstName && <p className="text-xs text-red-600">{errors.firstName.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="register-lastName">Επώνυμο</Label>
          <Input id="register-lastName" {...register("lastName")} />
          {errors.lastName && <p className="text-xs text-red-600">{errors.lastName.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="register-email">Email</Label>
        <Input id="register-email" type="email" autoComplete="email" {...register("email")} />
        {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="register-phone">Τηλέφωνο (προαιρετικό)</Label>
        <Input id="register-phone" type="tel" {...register("phone")} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="register-password">Κωδικός</Label>
          <Input id="register-password" type="password" autoComplete="new-password" {...register("password")} />
          {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="register-confirmPassword">Επιβεβαίωση κωδικού</Label>
          <Input id="register-confirmPassword" type="password" autoComplete="new-password" {...register("confirmPassword")} />
          {errors.confirmPassword && <p className="text-xs text-red-600">{errors.confirmPassword.message}</p>}
        </div>
      </div>

      <div className="flex items-start gap-2.5">
        <Checkbox
          id="register-consent"
          checked={consent === true}
          onCheckedChange={(checked) => setValue("consent", checked === true ? true : (undefined as never))}
        />
        <Label htmlFor="register-consent" className="text-sm font-normal text-ink-muted">
          Συμφωνώ με την{" "}
          <a href="#" className="text-primary underline-offset-2 hover:underline">
            πολιτική απορρήτου
          </a>
          .
        </Label>
      </div>
      {errors.consent && <p className="text-xs text-red-600">{errors.consent.message}</p>}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Εγγραφή
      </Button>

      <p className="text-center text-sm text-ink-muted">
        Έχετε ήδη λογαριασμό;{" "}
        <Link href="/login" className="text-primary hover:underline">
          Συνδεθείτε
        </Link>
      </p>
    </form>
  );
}
