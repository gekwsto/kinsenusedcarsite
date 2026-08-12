/**
 * The premium "navy → expanding teal circle" hover/press interaction —
 * shared by exactly two controls: the navbar "Σύνδεση" action
 * (`src/components/layout/header.tsx`) and the Login page's main
 * "Σύνδεση" submit button (`src/components/forms/login-form.tsx`).
 * Centralized here purely to stop those two from drifting apart visually;
 * neither's state/semantics (Link vs. `<button type="submit">`,
 * auth/navigation behavior) is touched by this module at all.
 *
 * Deliberately carries no size/shape opinion (no width, height, padding,
 * or border-radius) — each caller keeps its own context-appropriate
 * dimensions. Compose with a caller's own classes via
 * `cn(KINSEN_GLOW_SURFACE_CLASSNAME, "...")`.
 */
export const KINSEN_GLOW_SURFACE_CLASSNAME =
  "group relative isolate transition-[box-shadow,transform] duration-200 ease-out hover:bg-primary hover:shadow-[0_6px_18px_rgba(0,137,154,0.28)] active:scale-[0.97] motion-reduce:transition-none";

/**
 * The decorative layers: a fixed 480px circle scaling from 0 to fully cover
 * the button on hover, plus a near-invisible depth overlay above it. 480px
 * comfortably exceeds the corner-to-center diagonal of both current
 * consumers — the compact ~145px navbar pill AND the Login page's
 * full-width submit button (up to `max-w-md` minus the form's own padding,
 * ~400px wide, ~402px diagonal) — a plain fixed pixel size (not e.g. a
 * percentage of the button's own dimensions, which would stretch into an
 * ellipse on a non-square button) is what keeps this circular at every
 * frame of the animation regardless of which consumer renders it.
 *
 * Render as the FIRST child inside the interactive element, before its
 * real label/icon/spinner — that sibling content must use `relative z-10`
 * to paint above these layers.
 *
 * `overflow-hidden` lives on THIS wrapper, never on the button itself — a
 * button's own `overflow: hidden` also clips its own outward
 * `focus-visible` ring, silently breaking keyboard accessibility.
 */
export function KinsenGlowOverlay() {
  return (
    <span aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-[inherit]">
      <span className="absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-detail transition-transform duration-[500ms] ease-[cubic-bezier(0,0,0.2,1)] motion-reduce:transition-none group-hover:scale-100" />
      <span className="absolute inset-0 z-[1] bg-gradient-to-b from-white/10 via-transparent to-black/10" />
    </span>
  );
}
