"use client";

import * as React from "react";
import { useReducedMotion } from "motion/react";

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const FRAME_MS = 28;
// How many scramble frames each character sits through before locking in,
// on top of its own left-to-right reveal position — produces the classic
// "decrypting" sweep (each letter flickers briefly, then resolves in turn)
// rather than the whole word resolving in one single frame.
const STEPS_PER_CHAR = 2;

function randomChar(): string {
  return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]!;
}

/**
 * Text-scramble hover/focus effect: the visible text briefly cycles through
 * random characters, resolving back to the real word left to right. Pure
 * client-side animation (setTimeout-driven), no dependency added — inspired
 * by the classic "decrypt reveal" pattern seen on premium tech-brand sites,
 * not copied code or assets from any of them.
 *
 * Screen readers never see the scrambled frames: the animated text is
 * aria-hidden and the link's real accessible name is set directly via
 * aria-label, so this is a cosmetic, sighted-user-only effect. Skips the
 * animation entirely under prefers-reduced-motion — the link still works,
 * it just never flickers, matching how the rest of this codebase treats
 * reduced motion (see the homepage carousel).
 */
export function ScrambleLink({
  text,
  ariaLabel,
  href,
  className,
  external = false,
}: {
  text: string;
  /** Real accessible name, properly cased (e.g. "LinkedIn") — kept separate
   * from `text` because `text` is often an all-caps display treatment
   * ("LINKEDIN") that would otherwise leak into the accessible name too. */
  ariaLabel?: string;
  href: string;
  className?: string;
  external?: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [display, setDisplay] = React.useState(text);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const runScramble = React.useCallback(() => {
    if (shouldReduceMotion) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const totalFrames = text.length * STEPS_PER_CHAR;
    let frame = 0;

    const tick = () => {
      const revealCount = Math.floor(frame / STEPS_PER_CHAR);
      setDisplay(
        text
          .split("")
          .map((char, index) => (index < revealCount || char === " " ? char : randomChar()))
          .join(""),
      );
      frame += 1;
      if (frame <= totalFrames) {
        timeoutRef.current = setTimeout(tick, FRAME_MS);
      } else {
        setDisplay(text);
      }
    };
    tick();
  }, [text, shouldReduceMotion]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      aria-label={ariaLabel ?? text}
      onMouseEnter={runScramble}
      onFocus={runScramble}
      className={className}
    >
      <span aria-hidden="true">{display}</span>
    </a>
  );
}
