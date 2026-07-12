import { NavigationFallbackSignal } from "@/components/navigation/navigation-fallback-signal";

// Suspense fallback for the public route group. Renders no visual markup —
// see NavigationFallbackSignal.
export default function Loading() {
  return <NavigationFallbackSignal />;
}
