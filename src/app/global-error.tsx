"use client";

import { useEffect } from "react";

// Root-level last resort: only fires when the root layout itself (or
// something above every other boundary) throws, so this REPLACES
// app/layout.tsx entirely and must define its own <html>/<body> per the
// Next.js global-error.tsx contract. Deliberately does not import
// PublicStatusState, Tailwind utility classes, next/link, or any provider —
// none of those can be assumed to still work when the normal tree has
// failed this badly, so every style here is inline and every link is a
// plain <a>. Keep this file self-contained; do not wire it to DB/vehicle
// services, auth state, or app providers.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="el">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          backgroundColor: "#F5F7FA",
          color: "#1E293B",
          fontFamily:
            "'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "440px",
            textAlign: "center",
            backgroundColor: "#FFFFFF",
            border: "1px solid #CBD5E1",
            borderRadius: "24px",
            padding: "40px 32px",
            boxShadow: "0 2px 12px rgba(2, 56, 89, 0.08)",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              margin: "0 auto 20px",
              width: "56px",
              height: "56px",
              borderRadius: "9999px",
              border: "1px solid rgba(57, 192, 195, 0.35)",
              backgroundColor: "rgba(57, 192, 195, 0.1)",
              color: "#2ea9ac",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              fontWeight: 700,
            }}
          >
            !
          </div>

          <h1 style={{ margin: "0 0 12px", fontSize: "22px", fontWeight: 700, color: "#001858" }}>
            Παρουσιάστηκε ένα προσωρινό πρόβλημα
          </h1>
          <p style={{ margin: "0 0 28px", fontSize: "14px", lineHeight: 1.6, color: "#64748B" }}>
            Δοκιμάστε ξανά σε λίγα δευτερόλεπτα.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                width: "100%",
                height: "48px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#023859",
                color: "#FFFFFF",
                fontSize: "15px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Δοκιμάστε ξανά
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- deliberate: see file-level comment, next/link's router context can't be assumed available here */}
            <a
              href="/"
              style={{
                width: "100%",
                height: "48px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                backgroundColor: "#FFFFFF",
                color: "#1E293B",
                fontSize: "15px",
                fontWeight: 600,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Αρχική σελίδα
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
