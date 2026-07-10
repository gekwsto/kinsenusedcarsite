import type { Metadata } from "next";
import { RegisterForm } from "@/components/forms/register-form";

export const metadata: Metadata = {
  title: "Εγγραφή",
  description: "Δημιουργήστε λογαριασμό στην Kinsen για να αποθηκεύετε αγαπημένα οχήματα και να παρακολουθείτε τα αιτήματά σας.",
  alternates: { canonical: "/register" },
};

export default function RegisterPage() {
  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-ink">Δημιουργία λογαριασμού</h1>
        <RegisterForm />
      </div>
    </div>
  );
}
