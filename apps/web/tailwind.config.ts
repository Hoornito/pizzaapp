import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  corePlugins: {
    // Disable preflight to avoid conflicts with MUI's CssBaseline
    preflight: false,
  },
  important: '#__next',
  theme: {
    extend: {
      colors: {
        pizza: {
          red: '#C62828',
          'red-dark': '#8E0000',
          orange: '#F57C00',
          cream: '#FFF8E1',
        },
      },
      fontFamily: {
        sans: ['var(--font-roboto)', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
