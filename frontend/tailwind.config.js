/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // RedEngine Dark Design System
        'engine': {
          'bg-primary': '#0B0B0F',
          'bg-surface': '#18181F',
          'border': '#2A2A33',
          'accent-red': '#FF3B3B',
          'text-primary': '#E6E6EB',
          'text-secondary': '#A1A1AA',
          'success': '#22C55E',
          'warning': '#F59E0B',
        },
      },
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'h1': ['32px', { lineHeight: '1.2' }],
        'h2': ['24px', { lineHeight: '1.3' }],
        'h3': ['18px', { lineHeight: '1.4' }],
        'body': ['15px', { lineHeight: '1.5' }],
        'small': ['13px', { lineHeight: '1.5' }],
      },
      spacing: {
        '1': '8px',
        '2': '16px',
        '3': '24px',
        '4': '32px',
        '6': '48px',
      },
      borderRadius: {
        'card': '14px',
        'md': '10px',
        'lg': '14px',
      },
      backgroundColor: {
        'primary': '#0B0B0F',
        'surface': '#18181F',
      },
      textColor: {
        'primary': '#E6E6EB',
        'secondary': '#A1A1AA',
      },
      borderColor: {
        'default': '#2A2A33',
      },
    },
  },
  plugins: [],
}
