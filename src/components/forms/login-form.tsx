"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useNavigationTransition } from "@/components/providers/navigation-transition-provider";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { loginSchema, type LoginInput } from "@/lib/validators/auth.schema";

export function LoginForm() {
  const router = useRouter();
  const transition = useNavigationTransition();
  const searchParams = useSearchParams();
  const explicitCallbackUrl = searchParams.get("callbackUrl");
  const registered = searchParams.get("registered") === "1";

  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Routes the post-login redirect through the shared navigation loader when
  // available, falling back to a plain router.push (still fully functional,
  // just without the overlay) if this ever renders outside the provider.
  const goTo = (href: string) => (transition ? transition.navigate(href) : router.push(href));

  const onSubmit = async (values: LoginInput) => {
    setSubmitting(true);
    setError(null);

    const result = await signIn("credentials", { ...values, redirect: false });

    if (!result || result.error) {
      setSubmitting(false);
      setError("Λανθάσμενα στοιχεία σύνδεσης");
      return;
    }

    // Hand off to the shared navigation loader right as each redirect is
    // triggered, rather than leaving this form's own spinner running
    // underneath it — the overlay is the single loading indicator for the
    // destination that's about to load.
    if (explicitCallbackUrl) {
      setSubmitting(false);
      goTo(explicitCallbackUrl);
    } else {
      const session = await getSession();
      const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";
      setSubmitting(false);
      goTo(isAdmin ? "/admin" : "/account");
    }
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-card border border-border bg-white p-6 shadow-soft">
      {registered && (
        <p className="rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent-dark">
          Ο λογαριασμός σας δημιουργήθηκε επιτυχώς. Συνδεθείτε για να συνεχίσετε.
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="login-email">Email</Label>
        <Input id="login-email" type="email" autoComplete="email" {...register("email")} />
        {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="login-password">Κωδικός</Label>
        <div className="relative">
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="pr-10"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Απόκρυψη κωδικού" : "Εμφάνιση κωδικού"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox id="login-remember" />
          <Label htmlFor="login-remember" className="text-sm font-normal text-ink-muted">
            Να με θυμάσαι
          </Label>
        </div>
        <a href="#" className="text-sm text-primary hover:underline">
          Ξεχάσατε τον κωδικό;
        </a>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Σύνδεση
      </Button>
    </form>
  );
}
