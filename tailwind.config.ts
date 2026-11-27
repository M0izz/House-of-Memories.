import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#FFF8F5",
          50: "#FFFFFF",
          100: "#FFFDFB",
          200: "#FFF8F5",
          300: "#F9ECE5",
          400: "#F2DDD3",
        },
        blush: {
          DEFAULT: "#F6E4EC",
          light: "#FDF4F8",
          dark: "#E8C2D3",
        },
        lavender: {
          DEFAULT: "#EDE8F7",
          light: "#F8F5FC",
          dark: "#D7CCEB",
        },
        sage: {
          DEFAULT: "#E4F0E8",
          light: "#F2F8F4",
          dark: "#C3DBCB",
        },
        butter: {
          DEFAULT: "#F7EBD5",
          light: "#FDF8EE",
          dark: "#EAD4AA",
        },
        plum: {
          DEFAULT: "#493C46",
          light: "#6B5B67",
          muted: "#8C7C88",
          dark: "#32272F",
        },
        border: "hsl(var(--border, 24 20% 90%))",
      },
      fontFamily: {
        serif: ["var(--font-playfair)", "Playfair Display", "Georgia", "serif"],
        sans: ["var(--font-dmsans)", "DM Sans", "Inter", "sans-serif"],
        handwriting: ["var(--font-caveat)", "Caveat", "Comic Sans MS", "cursive"],
      },
      borderRadius: {
        scrapbook: "18px 24px 20px 22px",
        polaroid: "12px",
      },
      boxShadow: {
        paper: "0 2px 12px -2px rgba(73, 60, 70, 0.06), 0 1px 3px rgba(73, 60, 70, 0.04)",
        float: "0 10px 30px -5px rgba(73, 60, 70, 0.1), 0 4px 6px -2px rgba(73, 60, 70, 0.05)",
        polaroid: "0 4px 20px -2px rgba(73, 60, 70, 0.12), 0 2px 6px -1px rgba(73, 60, 70, 0.08)",
      },
      animation: {
        "float-gentle": "float 6s ease-in-out infinite",
        "pulse-soft": "pulseSoft 4s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.8" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
