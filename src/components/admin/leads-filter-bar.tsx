"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_OPTIONS = ["all", "NEW", "CONTACTED", "IN_PROGRESS", "WON", "LOST", "SPAM"];
const INTEREST_OPTIONS = ["all", "LEASING", "FINANCING", "TEST_DRIVE", "GENERAL"];

export function LeadsFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  const exportParams = new URLSearchParams();
  if (searchParams.get("status")) exportParams.set("status", searchParams.get("status")!);
  if (searchParams.get("interestType")) exportParams.set("interestType", searchParams.get("interestType")!);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select value={searchParams.get("status") ?? "all"} onValueChange={(v) => updateParam("status", v)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Κατάσταση" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt === "all" ? "Όλες οι καταστάσεις" : opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("interestType") ?? "all"}
        onValueChange={(v) => updateParam("interestType", v)}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Τύπος Ενδιαφέροντος" />
        </SelectTrigger>
        <SelectContent>
          {INTEREST_OPTIONS.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt === "all" ? "Όλοι οι τύποι" : opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        placeholder="Vehicle ID"
        className="w-44"
        defaultValue={searchParams.get("vehicleId") ?? ""}
        onBlur={(e) => updateParam("vehicleId", e.target.value)}
      />

      <Button variant="outline" asChild className="ml-auto">
        <a href={`/api/admin/leads/export?${exportParams.toString()}`}>
          <Download className="h-4 w-4" />
          Export CSV
        </a>
      </Button>
    </div>
  );
}
