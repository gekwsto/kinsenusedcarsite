/**
 * The Kinsen corporate CTA — one calm, static appearance on every device:
 * solid deep navy, white text/icon, a subtle same-family navy border and
 * corporate shadow. Previously an animated hover-fill interaction (a light
 * resting surface with a navy diagonal fill that grew in on hover, plus an
 * offset "depth" shadow layer that settled flush on hover, both gated to
 * `(hover: hover) and (pointer: fine)` to avoid a stuck fill on touch) —
 * the design direction changed to a single static look instead, so none of
 * that machinery exists anymore: no wrapper `<span>`, no
 * `KinsenCtaFill`/`KinsenCtaDepth` layers, no hover-capability media query.
 * Every consumer (Navbar/Login "Σύνδεση", the homepage CTAs, the
 * comparison launcher/panel CTA, the cookie modal's "Αποδοχή όλων", the
 * comparison page's "Επιστροφή στα αυτοκίνητα") now renders a plain
 * `<Button variant="primary" className={KINSEN_CTA_BUTTON_CLASSNAME}>` —
 * nothing else to render, no extra markup.
 *
 * Pair with `variant="primary"` — its own `bg-primary text-white
 * shadow-soft` are kept as-is; this class only adds a same-family navy
 * border (`border-primary-dark`, one shade darker so it actually reads
 * against the `bg-primary` fill instead of disappearing into it), cancels
 * that variant's own `hover:bg-primary-dark` (this CTA wants zero hover
 * color shift, not a darker navy), and keeps a restrained press-only
 * `active:scale`. `focus-visible` needs no separate declaration here — the
 * shared `Button` base already carries
 * `focus-visible:ring-2 focus-visible:ring-primary/50`, and its
 * `disabled:opacity-50 disabled:pointer-events-none` already keeps a
 * disabled/loading CTA from reading as interactive, same as before. Icons
 * and text need no explicit color class of their own: both inherit the
 * button's own `text-white` via plain CSS inheritance/`currentColor`.
 */
export const KINSEN_CTA_BUTTON_CLASSNAME =
  "border border-primary-dark shadow-soft hover:bg-primary active:scale-[0.99] transition-transform duration-150 motion-reduce:transition-none";
