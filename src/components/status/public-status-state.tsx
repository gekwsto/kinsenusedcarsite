import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PublicStatusStateProps {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: React.ReactNode;
  secondaryAction?: React.ReactNode;
  tertiaryAction?: React.ReactNode;
  className?: string;
}

// Shared shell for the public site's not-found/error states (general 404,
// vehicle not-found, recoverable error) — icon badge + eyebrow + heading +
// description + up to three actions, in the site's existing card language
// (rounded-3xl, border-border, shadow-soft). Deliberately not used by
// global-error.tsx, which must render without depending on Tailwind's
// compiled output being guaranteed present — see that file's own comment.
export function PublicStatusState({
  icon: Icon,
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  tertiaryAction,
  className,
}: PublicStatusStateProps) {
  return (
    <div className={cn("container-page flex min-h-[60vh] items-center justify-center py-16 sm:py-24", className)}>
      <div className="w-full max-w-lg animate-slide-up rounded-3xl border border-border bg-white p-8 text-center shadow-soft motion-reduce:animate-none sm:p-10">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-accent/25 bg-accent/10 text-accent-dark">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide text-accent-dark">{eyebrow}</p>
        <h1 className="mt-3 text-2xl font-bold text-navy sm:text-3xl">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-ink-muted sm:text-base">{description}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {primaryAction}
          {secondaryAction}
        </div>

        {tertiaryAction ? <div className="mt-6 text-sm">{tertiaryAction}</div> : null}
      </div>
    </div>
  );
}
