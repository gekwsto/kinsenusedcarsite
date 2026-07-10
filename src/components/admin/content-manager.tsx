"use client";

import * as React from "react";
import { Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import type {
  ContentKey,
  HeroContent,
  StatsContent,
  HowItWorksContent,
  BenefitsContent,
  InfoHeroContent,
  InfoCardsContent,
} from "@/lib/content-defaults";

function useContentSection<T>(sectionKey: ContentKey, initialValue: T) {
  const { toast } = useToast();
  const [value, setValue] = React.useState<T>(initialValue);
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/content/${sectionKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Αποτυχία αποθήκευσης");
      }
      const updated = await res.json();
      setValue(updated);
      toast({ title: "Αποθηκεύτηκε", description: "Το περιεχόμενο ενημερώθηκε." });
    } catch (error) {
      toast({ title: "Σφάλμα", description: error instanceof Error ? error.message : "Κάτι πήγε στραβά", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/content/${sectionKey}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Αποτυχία επαναφοράς");
      const data = await res.json();
      setValue(data.value);
      toast({ title: "Έγινε επαναφορά στις προεπιλεγμένες τιμές" });
    } catch (error) {
      toast({ title: "Σφάλμα", description: error instanceof Error ? error.message : "Κάτι πήγε στραβά", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return { value, setValue, save, reset, saving };
}

function SectionActions({ onSave, onReset, saving }: { onSave: () => void; onReset: () => void; saving: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button type="button" variant="outline" size="sm" onClick={onReset} disabled={saving}>
        <RotateCcw className="h-3.5 w-3.5" /> Προεπιλογή
      </Button>
      <Button type="button" size="sm" onClick={onSave} disabled={saving}>
        <Save className="h-3.5 w-3.5" /> {saving ? "Αποθήκευση…" : "Αποθήκευση"}
      </Button>
    </div>
  );
}

export function HeroEditor({ initialValue }: { initialValue: HeroContent }) {
  const { value, setValue, save, reset, saving } = useContentSection<HeroContent>("home.hero", initialValue);
  return (
    <Card>
      <CardHeader><CardTitle>Αρχική — Κεντρικός τίτλος (Hero)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Γραμμή 1</Label>
            <Input value={value.line1} onChange={(e) => setValue({ ...value, line1: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Γραμμή 2</Label>
            <Input value={value.line2} onChange={(e) => setValue({ ...value, line2: e.target.value })} />
          </div>
        </div>
        <SectionActions onSave={save} onReset={reset} saving={saving} />
      </CardContent>
    </Card>
  );
}

export function StatsEditor({ initialValue }: { initialValue: StatsContent }) {
  const { value, setValue, save, reset, saving } = useContentSection<StatsContent>("home.stats", initialValue);
  return (
    <Card>
      <CardHeader><CardTitle>Αρχική — Κείμενο περιγραφής</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Επικεφαλίδα</Label>
          <Input value={value.heading} onChange={(e) => setValue({ ...value, heading: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Παράγραφος 1</Label>
          <Textarea rows={3} value={value.paragraph1} onChange={(e) => setValue({ ...value, paragraph1: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Παράγραφος 2</Label>
          <Textarea rows={2} value={value.paragraph2} onChange={(e) => setValue({ ...value, paragraph2: e.target.value })} />
        </div>
        <SectionActions onSave={save} onReset={reset} saving={saving} />
      </CardContent>
    </Card>
  );
}

export function HowItWorksEditor({ initialValue }: { initialValue: HowItWorksContent }) {
  const { value, setValue, save, reset, saving } = useContentSection<HowItWorksContent>("home.howItWorks", initialValue);

  const updateStep = (index: number, field: "title" | "description", text: string) => {
    const steps = value.steps.map((step, i) => (i === index ? { ...step, [field]: text } : step));
    setValue({ ...value, steps });
  };

  return (
    <Card>
      <CardHeader><CardTitle>Αρχική — &quot;Πώς Λειτουργεί&quot;</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Επικεφαλίδα ενότητας</Label>
            <Input value={value.heading} onChange={(e) => setValue({ ...value, heading: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Υπότιτλος</Label>
            <Input value={value.subtitle} onChange={(e) => setValue({ ...value, subtitle: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {value.steps.map((step, index) => (
            <div key={index} className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-xs font-semibold text-ink-muted">Βήμα {index + 1}</p>
              <Input value={step.title} onChange={(e) => updateStep(index, "title", e.target.value)} placeholder="Τίτλος" />
              <Textarea
                rows={3}
                value={step.description}
                onChange={(e) => updateStep(index, "description", e.target.value)}
                placeholder="Περιγραφή"
              />
            </div>
          ))}
        </div>
        <SectionActions onSave={save} onReset={reset} saving={saving} />
      </CardContent>
    </Card>
  );
}

export function BenefitsEditor({ initialValue }: { initialValue: BenefitsContent }) {
  const { value, setValue, save, reset, saving } = useContentSection<BenefitsContent>("home.benefits", initialValue);

  const updateCard = (index: number, field: "title" | "description", text: string) => {
    const cards = value.cards.map((card, i) => (i === index ? { ...card, [field]: text } : card));
    setValue({ cards });
  };

  return (
    <Card>
      <CardHeader><CardTitle>Αρχική — 3 κάρτες οφελών</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {value.cards.map((card, index) => (
            <div key={index} className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-xs font-semibold text-ink-muted">Κάρτα {index + 1} (η εικόνα δεν επεξεργάζεται εδώ)</p>
              <Input value={card.title} onChange={(e) => updateCard(index, "title", e.target.value)} placeholder="Τίτλος" />
              <Textarea
                rows={5}
                value={card.description}
                onChange={(e) => updateCard(index, "description", e.target.value)}
                placeholder="Περιγραφή"
              />
            </div>
          ))}
        </div>
        <SectionActions onSave={save} onReset={reset} saving={saving} />
      </CardContent>
    </Card>
  );
}

export function InfoHeroEditor({
  sectionKey,
  label,
  initialValue,
}: {
  sectionKey: ContentKey;
  label: string;
  initialValue: InfoHeroContent;
}) {
  const { value, setValue, save, reset, saving } = useContentSection<InfoHeroContent>(sectionKey, initialValue);
  return (
    <Card>
      <CardHeader><CardTitle>{label} — Τίτλος σελίδας</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Τίτλος</Label>
          <Input value={value.title} onChange={(e) => setValue({ ...value, title: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Υπότιτλος</Label>
          <Input value={value.subtitle} onChange={(e) => setValue({ ...value, subtitle: e.target.value })} />
        </div>
        <SectionActions onSave={save} onReset={reset} saving={saving} />
      </CardContent>
    </Card>
  );
}

export function InfoCardsEditor({
  sectionKey,
  label,
  initialValue,
}: {
  sectionKey: ContentKey;
  label: string;
  initialValue: InfoCardsContent;
}) {
  const { value, setValue, save, reset, saving } = useContentSection<InfoCardsContent>(sectionKey, initialValue);

  const updateCard = (index: number, field: "title" | "body", text: string) => {
    const cards = value.cards.map((card, i) => (i === index ? { ...card, [field]: text } : card));
    setValue({ cards });
  };

  return (
    <Card>
      <CardHeader><CardTitle>{label} — Κάρτες πληροφοριών</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-ink-muted">
          Στο κείμενο, βάλτε κάθε bullet σε ξεχωριστή γραμμή για να εμφανιστεί ως λίστα αντί για παράγραφος.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {value.cards.map((card, index) => (
            <div key={index} className="space-y-2 rounded-lg border border-border p-3">
              <Input value={card.title} onChange={(e) => updateCard(index, "title", e.target.value)} placeholder="Τίτλος κάρτας" />
              <Textarea rows={5} value={card.body} onChange={(e) => updateCard(index, "body", e.target.value)} placeholder="Κείμενο" />
            </div>
          ))}
        </div>
        <SectionActions onSave={save} onReset={reset} saving={saving} />
      </CardContent>
    </Card>
  );
}
