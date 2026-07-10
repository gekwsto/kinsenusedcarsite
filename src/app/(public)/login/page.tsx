import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/forms/login-form";

export const metadata: Metadata = {
  title: "Σύνδεση",
  description: "Συνδεθείτε στον λογαριασμό σας στην Kinsen για να δείτε τα αγαπημένα σας οχήματα και τα αιτήματά σας.",
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-ink">Σύνδεση</h1>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
