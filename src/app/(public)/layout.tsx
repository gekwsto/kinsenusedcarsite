import { FavoritesProvider } from "@/components/providers/favorites-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

// Every public page reads live DB state (site settings, vehicle inventory,
// FAQ) or session-based UI (header login state), so static generation buys
// nothing here and would only serve stale content — render per-request.
export const dynamic = "force-dynamic";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <FavoritesProvider>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </FavoritesProvider>
  );
}
