import { NavigationFallbackSignal } from "@/components/navigation/navigation-fallback-signal";

// Suspense fallback for the /vehicles segment. Renders no visual markup —
// no skeleton, no grid placeholder — see NavigationFallbackSignal.
export default function Loading() {
  return <NavigationFallbackSignal />;
}
