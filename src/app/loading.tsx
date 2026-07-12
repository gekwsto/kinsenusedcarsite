import { NavigationFallbackSignal } from "@/components/navigation/navigation-fallback-signal";

// Suspense fallback for any top-level segment without a more specific
// nested loading.tsx (currently /admin/*) and the initial server stream.
// Renders no visual markup of its own — see NavigationFallbackSignal.
export default function Loading() {
  return <NavigationFallbackSignal />;
}
