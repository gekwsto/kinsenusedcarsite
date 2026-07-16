import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Exact brand palette pulled from usedcars.kinsen.gr (main.css / navbar.css / footer.css).
        primary: {
          DEFAULT: "#023859", // nav text, buttons, filter section headers
          dark: "#012638",
          light: "#22577A",
        },
        secondary: {
          DEFAULT: "#22577A",
        },
        navy: {
          DEFAULT: "#001858", // hero title, how-it-works headings, stats paragraph
        },
        footer: {
          DEFAULT: "#032e47", // footer background + CTA button background
        },
        accent: {
          DEFAULT: "#39c0c3", // brand teal — hero accent word, spinner, links, hover states
          dark: "#2ea9ac",
        },
        filterHeading: {
          DEFAULT: "#007c91", // "Φίλτρα" heading + "Καθαρισμός" clear-filters button
        },
        offer: {
          DEFAULT: "#2ec4c7", // discount/offer badge
        },
        detail: {
          DEFAULT: "#00899a", // vehicle detail page accent (tabs, price label, icons, CTA buttons)
          title: "#0b2239", // vehicle detail page title/price text
        },
        ink: {
          DEFAULT: "#1E293B",
          muted: "#64748B",
        },
        border: {
          DEFAULT: "#CBD5E1",
        },
        surface: {
          DEFAULT: "#F5F7FA",
        },
        favorite: {
          active: "#023859",
          inactive: "#696c6d",
        },
      },
      borderRadius: {
        card: "0.75rem",
      },
      boxShadow: {
        soft: "0 2px 12px rgba(2, 56, 89, 0.08)",
        card: "0 4px 20px rgba(2, 56, 89, 0.10)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // Animates the real measured height Radix exposes via this CSS var,
        // instead of only fading opacity — without it, Content jumps to its
        // full height the instant `data-state` flips to open/closed (before
        // any opacity transition even starts), which reads as a flash/flicker
        // on the section header sitting right above it.
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-up": "slide-up 0.25s ease-out",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
