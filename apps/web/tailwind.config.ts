import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
      colors: {
        ink: "oklch(0.22 0.02 258)",
        paper: "oklch(0.985 0.003 258)",
        line: "oklch(0.91 0.005 258)",
        muted: "oklch(0.55 0.01 258)",
        sidebar: {
          DEFAULT: "oklch(0.24 0.03 258)",
          active: "oklch(0.32 0.045 258)",
          text: "oklch(0.72 0.02 258)",
          muted: "oklch(0.5 0.02 258)",
        },
        accent: {
          DEFAULT: "oklch(0.55 0.16 255)",
          soft: "oklch(0.94 0.03 255)",
          text: "oklch(0.45 0.13 255)",
        },
        success: {
          DEFAULT: "oklch(0.55 0.14 150)",
          soft: "oklch(0.94 0.05 150)",
          text: "oklch(0.4 0.13 150)",
        },
        warn: {
          DEFAULT: "oklch(0.6 0.14 80)",
          soft: "oklch(0.95 0.05 85)",
          text: "oklch(0.5 0.12 80)",
        },
        danger: {
          DEFAULT: "oklch(0.55 0.19 25)",
          soft: "oklch(0.94 0.05 25)",
          text: "oklch(0.45 0.15 25)",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
