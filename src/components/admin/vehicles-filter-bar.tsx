"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_OPTIONS = [
  { value: "all", label: "Όλες οι καταστάσεις" },
  { value: "active", label: "Ενεργά" },
  { value: "frozen", label: "Παγωμένα" },
  { value: "deleted", label: "Διαγραμμένα" },
  { value: "offer", label: "Προσφορές" },
];

export function VehiclesFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <form
        className="flex min-w-[260px] flex-1 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          updateParam("search", search);
        }}
      >
        <Input
          placeholder="Κατασκευαστής, μοντέλο, VIN, πινακίδα, external ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="submit" variant="outline">
          <Search className="h-4 w-4" />
          Αναζήτηση
        </Button>
      </form>

      <Select value={searchParams.get("status") ?? "all"} onValueChange={(v) => updateParam("status", v)}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        placeholder="Κατασκευαστής"
        className="w-36"
        defaultValue={searchParams.get("maker") ?? ""}
        onBlur={(e) => updateParam("maker", e.target.value)}
      />
      <Input
        placeholder="Καύσιμο"
        className="w-32"
        defaultValue={searchParams.get("fuel") ?? ""}
        onBlur={(e) => updateParam("fuel", e.target.value)}
      />
      <Input
        placeholder="Κιβώτιο"
        className="w-32"
        defaultValue={searchParams.get("transmissionType") ?? ""}
        onBlur={(e) => updateParam("transmissionType", e.target.value)}
      />
    </div>
  );
}
