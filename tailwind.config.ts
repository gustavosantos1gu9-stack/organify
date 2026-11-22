import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── New light-theme tokens ──────────────────────────────────
        navy: "#0A1826",
        brand: {
          DEFAULT: "#1C6CA6",
          deep: "#144E73",
          light: "#8CC6EC",
        },
        "off-white": "#EEF1F4",
        "white-text": "#F3F5F7",
        "card-bg": "#FFFFFF",
        "text-secondary": "#4A5B6C",
        "hover-row": "#F3F5F7",

        // ── State / phase colors ────────────────────────────────────
        phase: {
          alert: "#B42318",
          warning: "#8A3B12",
          caution: "#7A5B00",
          phase3: "#144E73",
          oscillating: "#4A2E9E",
          success: "#1E6B52",
          neutral: "#CBD5DF",
        },

        // ── Keep legacy dark tokens for any remaining refs ──────────
        bg: {
          primary: "#0f0f0f",
          secondary: "#1a1a1a",
          tertiary: "#222222",
          card: "#1e1e1e",
          hover: "#2a2a2a",
        },
        accent: {
          green: "#22c55e",
          "green-dim": "#16a34a",
          "green-subtle": "#14532d",
          "green-glow": "rgba(34,197,94,0.15)",
        },
        border: {
          DEFAULT: "#E6EBF0",
          strong: "#CBD5DF",
        },
        text: {
          primary: "#0A1826",
          secondary: "#4A5B6C",
          muted: "#7A8C9A",
        },
        red: {
          500: "#ef4444",
          subtle: "#450a0a",
          dim: "#991b1b",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["monospace"],
      },
      borderRadius: {
        DEFAULT: "12px",
        sm: "8px",
        lg: "20px",
        xl: "24px",
        full: "999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(10,24,38,.05), 0 8px 24px rgba(10,24,38,.06)",
        "card-hover": "0 4px 16px rgba(10,24,38,.10), 0 16px 40px rgba(10,24,38,.10)",
        btn: "0 1px 2px rgba(10,24,38,.08), 0 2px 8px rgba(10,24,38,.06)",
        "btn-primary": "0 1px 2px rgba(28,108,166,.20), 0 4px 12px rgba(28,108,166,.18)",
      },
    },
  },
  plugins: [],
};
export default config;
