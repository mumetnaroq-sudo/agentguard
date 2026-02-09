import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        gray: {
          950: "#0a0a0a",
          900: "#1a1a1a",
          800: "#2a2a2a",
          700: "#3a3a3a",
          600: "#4a4a4a",
          500: "#6a6a6a",
          400: "#9a9a9a",
          300: "#c0c0c0",
          200: "#e0e0e0",
          100: "#f0f0f0",
          50: "#fafafa",
        },
      },
    },
  },
  plugins: [],
};

export default config;
