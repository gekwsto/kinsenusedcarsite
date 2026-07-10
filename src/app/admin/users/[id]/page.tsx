import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { listAuditLogForTarget } from "@/server/services/audit.service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserActions } from "@/components/admin/user-actions";
import { formatEuro } from "@/lib/utils";

interface UserDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const currentUser = await requirePagePermission("USER_READ");
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      favorites: {
        include: { vehicle: { select: { id: true, maker: true, model: true, slug: true, price: true } } },
        orderBy: { createdAt: "desc" },
      },
      leads: {
        include: { vehicle: { select: { id: true, maker: true, model: true, slug: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) notFound();

  const auditLog = await listAuditLogForTarget("User", user.id);

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" asChild className="self-start">
        <Link href="/admin/users">
          <ArrowLeft className="h-4 w-4" />
          Πίσω στους χρήστες
        </Link>
      </Button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-ink">
            {[user.firstName, user.lastName].filter(Boolean).join(" ") || user.email}
          </h1>
          <Badge variant={user.isActive ? "available" : "muted"}>
            {user.isActive ? "Ενεργός" : "Ανενεργός"}
          </Badge>
          <Badge variant="default">{user.role}</Badge>
        </div>
        <UserActions userId={user.id} canResetPassword={hasPermission(currentUser, "USER_UPDATE")} />
      </div>
      <p className="text-sm text-ink-muted">
        {user.email}
        {user.phone ? ` · ${user.phone}` : ""}
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Αγαπημένα Οχήματα ({user.favorites.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-ink-muted">
                <th className="px-5 py-3">Όχημα</th>
                <th className="px-5 py-3">Τιμή</th>
              </tr>
            </thead>
            <tbody>
              {user.favorites.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-5 py-6 text-center text-ink-muted">
                    Δεν υπάρχουν αγαπημένα
                  </td>
                </tr>
              )}
              {user.favorites.map((fav) => (
                <tr key={fav.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3">
                    <Link href={`/admin/vehicles/${fav.vehicle.id}`} className="text-primary hover:underline">
                      {fav.vehicle.maker} {fav.vehicle.model}
                    </Link>
                  </td>
                  <td className="px-5 py-3">{formatEuro(fav.vehicle.price?.toString() ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leads ({user.leads.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-ink-muted">
                <th className="px-5 py-3">Ημερομηνία</th>
                <th className="px-5 py-3">Τύπος</th>
                <th className="px-5 py-3">Όχημα</th>
                <th className="px-5 py-3">Κατάσταση</th>
              </tr>
            </thead>
            <tbody>
              {user.leads.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-ink-muted">
                    Δεν υπάρχουν leads
                  </td>
                </tr>
              )}
              {user.leads.map((lead) => (
                <tr key={lead.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 text-ink-muted">
                    {new Intl.DateTimeFormat("el-GR", { dateStyle: "short" }).format(lead.createdAt)}
                  </td>
                  <td className="px-5 py-3">{lead.interestType}</td>
                  <td className="px-5 py-3">
                    {lead.vehicle ? `${lead.vehicle.maker} ${lead.vehicle.model}` : "-"}
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant="muted">{lead.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ιστορικό Ενεργειών ({auditLog.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-ink-muted">
                <th className="px-5 py-3">Ημερομηνία</th>
                <th className="px-5 py-3">Ενέργεια</th>
                <th className="px-5 py-3">Από</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-6 text-center text-ink-muted">
                    Δεν υπάρχουν καταγεγραμμένες ενέργειες
                  </td>
                </tr>
              )}
              {auditLog.map((entry) => (
                <tr key={entry.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 text-ink-muted">
                    {new Intl.DateTimeFormat("el-GR", { dateStyle: "short", timeStyle: "short" }).format(
                      entry.createdAt,
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant="muted">{entry.action}</Badge>
                  </td>
                  <td className="px-5 py-3 text-ink-muted">{entry.actorEmail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
