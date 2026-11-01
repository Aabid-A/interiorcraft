import type { Config } from 'tailwindcss'

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: Object.fromEntries(["background", "foreground", "border", "input", "ring", "primary", "secondary", "muted", "accent", "destructive"].map((name) => [name, `var(--${name})`])),
    },
  },
  plugins: [],
} satisfies Config
