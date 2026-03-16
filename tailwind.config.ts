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
          DEFAULT: "#2e2e2e",
          strong: "#3a3a3a",
        },
        text: {
          primary: "#f0f0f0",
          secondary: "#a0a0a0",
          muted: "#606060",
        },
        red: {
          500: "#ef4444",
          subtle: "#450a0a",
          dim: "#991b1b",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      borderRadius: {
        DEFAULT: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.4)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.5)",
        green: "0 0 20px rgba(34,197,94,0.2)",
      },
    },
  },
  plugins: [],
};
export default config;
