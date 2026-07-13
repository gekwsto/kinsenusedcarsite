import type { Metadata } from "next";
import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { Mail, Phone, User as UserIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VehicleGrid } from "@/components/vehicles/vehicle-grid";
import { EmptyState } from "@/components/vehicles/empty-state";
import { LogoutButton } from "@/components/account/logout-button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listFavoriteVehicles } from "@/server/services/favorite.service";
import { listLeadsForUser } from "@/server/services/lead.service";

export const metadata: Metadata = {
  title: "Ο λογαριασμός μου",
  robots: { index: false, follow: false },
};

const INTEREST_LABELS: Record<string, string> = {
  LEASING: "Leasing",
  FINANCING: "Δανειοδότηση",
  TEST_DRIVE: "Test Drive",
  GENERAL: "Γενική ερώτηση",
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "Νέο",
  CONTACTED: "Επικοινωνήθηκε",
  IN_PROGRESS: "Σε εξέλιξη",
  WON: "Ολοκληρώθηκε",
  LOST: "Έκλεισε",
  SPAM: "Spam",
};

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="container-page py-12">
        <EmptyState
          title="Συνδεθείτε για να δείτε τον λογαριασμό σας"
          action={
            <Button asChild className="mt-2">
              <Link href="/login?callbackUrl=/account">Σύνδεση</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const [user, favoriteVehicles, leads] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { firstName: true, lastName: true, email: true, phone: true },
    }),
    listFavoriteVehicles(session.user.id),
    listLeadsForUser(session.user.id),
  ]);

  return (
    <div className="container-page py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Ο λογαριασμός μου</h1>
        <LogoutButton />
      </div>

      {(session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN") && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-card border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm text-ink">
            Έχετε δικαιώματα {session.user.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}.
          </p>
          <Button asChild size="sm">
            <Link href="/admin">Μετάβαση στον Πίνακα Διαχείρισης</Link>
          </Button>
        </div>
      )}

      <div className="mb-10 rounded-card border border-border bg-white p-6 shadow-soft">
        <h2 className="mb-4 text-lg font-semibold text-ink">Στοιχεία προφίλ</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-2.5 text-sm text-ink">
            <UserIcon className="h-4 w-4 text-primary" />
            {[user?.firstName, user?.lastName].filter(Boolean).join(" ") || session.user.name || "—"}
          </div>
          <div className="flex items-center gap-2.5 text-sm text-ink">
            <Mail className="h-4 w-4 text-primary" />
            {user?.email ?? session.user.email}
          </div>
          {user?.phone && (
            <div className="flex items-center gap-2.5 text-sm text-ink">
              <Phone className="h-4 w-4 text-primary" />
              {user.phone}
            </div>
          )}
        </div>
      </div>

      <div className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-ink">Αγαπημένα οχήματα</h2>
        {favoriteVehicles.length > 0 ? (
          <VehicleGrid vehicles={favoriteVehicles} />
        ) : (
          <EmptyState
            title="Δεν έχετε αγαπημένα οχήματα ακόμα"
            action={
              <Button asChild className="mt-2">
                <Link href="/vehicles">Δείτε διαθέσιμα οχήματα</Link>
              </Button>
            }
          />
        )}
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-ink">Τα αιτήματά μου</h2>
        {leads.length > 0 ? (
          <div className="overflow-x-auto rounded-card border border-border bg-white shadow-soft">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-ink-muted">
                <tr>
                  <th className="px-4 py-3">Ημερομηνία</th>
                  <th className="px-4 py-3">Τύπος</th>
                  <th className="px-4 py-3">Όχημα</th>
                  <th className="px-4 py-3">Κατάσταση</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-ink-muted">
                      {new Intl.DateTimeFormat("el-GR", { dateStyle: "medium" }).format(lead.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-ink">{INTEREST_LABELS[lead.interestType] ?? lead.interestType}</td>
                    <td className="px-4 py-3 text-ink">
                      {lead.vehicle ? (
                        <Link href={`/vehicles/${lead.vehicle.slug}`} className="text-primary hover:underline">
                          {lead.vehicle.maker} {lead.vehicle.versionName}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="muted">{STATUS_LABELS[lead.status] ?? lead.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Δεν έχετε υποβάλει αιτήματα ενδιαφέροντος ακόμα" />
        )}
      </div>
    </div>
  );
}
