"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

interface UserActionsProps {
  userId: string;
  canResetPassword: boolean;
}

export function UserActions({ userId, canResetPassword }: UserActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  if (!canResetPassword) return null;

  async function resetPassword() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: "POST" });
      if (!res.ok) throw new Error("Αποτυχία επαναφοράς κωδικού");
      const data = await res.json();
      setConfirmOpen(false);
      setTemporaryPassword(data.temporaryPassword);
      router.refresh();
    } catch (error) {
      toast({
        title: "Σφάλμα",
        description: error instanceof Error ? error.message : "Κάτι πήγε στραβά",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
        <KeyRound className="h-4 w-4" />
        Επαναφορά κωδικού
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Επαναφορά κωδικού πρόσβασης"
        description="Θα δημιουργηθεί ένας νέος προσωρινός κωδικός για τον χρήστη. Ο τρέχων κωδικός θα πάψει να ισχύει."
        confirmLabel="Επαναφορά"
        destructive={false}
        loading={loading}
        onConfirm={resetPassword}
      />

      <Dialog open={!!temporaryPassword} onOpenChange={(open) => !open && setTemporaryPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Νέος προσωρινός κωδικός</DialogTitle>
            <DialogDescription>
              Σημειώστε τον κωδικό τώρα — δεν θα εμφανιστεί ξανά. Μεταφέρετέ τον στον χρήστη με ασφαλή τρόπο.
            </DialogDescription>
          </DialogHeader>
          <code className="block rounded-lg bg-surface px-4 py-3 text-sm font-medium text-ink">
            {temporaryPassword}
          </code>
        </DialogContent>
      </Dialog>
    </>
  );
}
