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
                // Core Brand Palette — Teal Analytics
                primary: {
                    50: '#f0fdfa',
                    100: '#ccfbf1',
                    200: '#99f6e4',
                    300: '#5eead4',
                    400: '#2dd4bf',
                    500: '#0d9488', 
                    600: '#0f766e',
                    700: '#115e59',
                    800: '#134e4a',
                    900: '#134e4a',
                    950: '#042f2e',
                    DEFAULT: 'var(--primary)',
                },
                accent: {
                    50: '#ecfdf5',
                    100: '#d1fae5',
                    200: '#a7f3d0',
                    300: '#6ee7b7',
                    400: '#34d399',
                    500: '#10b981',
                    600: '#059669',
                    700: '#047857',
                    800: '#065f46',
                    900: '#064e3b',
                    950: '#022c22',
                    DEFAULT: 'var(--accent)',
                },
                background: {
                    DEFAULT: 'var(--background)',
                    secondary: 'var(--background-secondary)',
                    tertiary: '#181825',
                },
                foreground: {
                    DEFAULT: 'var(--foreground)',
                    muted: 'var(--foreground-muted)',
                },
                border: 'var(--border)',
                card: {
                    DEFAULT: 'var(--card)',
                    hover: 'var(--card-hover)',
                },
                success: 'var(--success)',
                warning: 'var(--warning)',
                error: 'var(--error)',
            },
            borderRadius: {
                '3xl': '1.5rem',
                '4xl': '2rem',
                '5xl': '2.5rem',
            },
            fontFamily: {
                outfit: ['var(--font-outfit)', 'sans-serif'],
                inter: ['var(--font-inter)', 'sans-serif'],
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
                'brand-gradient': 'linear-gradient(135deg, var(--primary), var(--accent))',
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'float': 'float 3s ease-in-out infinite',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-10px)' },
                }
            }
        },
    },
    plugins: [],
};
