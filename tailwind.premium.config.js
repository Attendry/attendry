/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Premium Design Tokens
      colors: {
        // Background System
        'premium-bg': '#0B0F1A',
        'premium-surface': '#1A1F2C',
        'premium-border': '#2D3344',
        
        // Text System
        'premium-text-primary': '#E6E8EC',
        'premium-text-secondary': '#9CA3AF',
        
        // Accent System
        'premium-accent': '#4ADE80', // Neo-green primary
        'premium-accent-secondary': '#38BDF8', // Cyan secondary
        
        // Semantic Colors
        'premium-success': '#4ADE80',
        'premium-warning': '#FBBF24',
        'premium-error': '#F87171',
        'premium-info': '#38BDF8',
        
        // Interactive States
        'premium-hover': '#2D3344',
        'premium-active': '#4ADE80',
        'premium-disabled': '#374151',
      },
      
      // Typography
      fontFamily: {
        'geist': ['Geist Sans', 'Inter', 'system-ui', 'sans-serif'],
        'geist-mono': ['Geist Mono', 'JetBrains Mono', 'monospace'],
      },
      
      // Spacing (premium spacing scale)
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      
      // Border Radius (premium rounded system)
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      
      // Shadows (minimal elevation system)
      boxShadow: {
        'premium-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'premium-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'premium-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'premium-glow': '0 0 20px rgba(74, 222, 128, 0.15)',
        'premium-glow-secondary': '0 0 20px rgba(56, 189, 248, 0.15)',
      },
      
      // Animation (premium motion system)
      animation: {
        'premium-fade-in': 'fadeIn 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        'premium-slide-up': 'slideUp 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        'premium-scale': 'scale 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        'premium-glow': 'glow 2s ease-in-out infinite alternate',
      },
      
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scale: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(74, 222, 128, 0.15)' },
          '100%': { boxShadow: '0 0 30px rgba(74, 222, 128, 0.25)' },
        },
      },
      
      // Transition (premium timing)
      transitionTimingFunction: {
        'premium': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      
      // Backdrop Blur
      backdropBlur: {
        'premium': '12px',
      },
      
      // Z-Index (premium layering)
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
    },
  },
  plugins: [
    // Custom utilities for premium design
    function({ addUtilities, theme }) {
      const newUtilities = {
        // Premium text utilities
        '.text-premium-primary': {
          color: theme('colors.premium-text-primary'),
        },
        '.text-premium-secondary': {
          color: theme('colors.premium-text-secondary'),
        },
        
        // Premium background utilities
        '.bg-premium': {
          backgroundColor: theme('colors.premium-bg'),
        },
        '.bg-premium-surface': {
          backgroundColor: theme('colors.premium-surface'),
        },
        
        // Premium border utilities
        '.border-premium': {
          borderColor: theme('colors.premium-border'),
        },
        
        // Premium accent utilities
        '.text-premium-accent': {
          color: theme('colors.premium-accent'),
        },
        '.bg-premium-accent': {
          backgroundColor: theme('colors.premium-accent'),
        },
        '.border-premium-accent': {
          borderColor: theme('colors.premium-accent'),
        },
        
        // Premium hover utilities
        '.hover-premium': {
          '&:hover': {
            backgroundColor: theme('colors.premium-hover'),
          },
        },
        
        // Premium focus utilities
        '.focus-premium': {
          '&:focus': {
            borderColor: theme('colors.premium-accent'),
            boxShadow: `0 0 0 1px ${theme('colors.premium-accent')}`,
          },
        },
        
        // Premium glow utilities
        '.glow-premium': {
          boxShadow: theme('boxShadow.premium-glow'),
        },
        '.glow-premium-secondary': {
          boxShadow: theme('boxShadow.premium-glow-secondary'),
        },
        
        // Premium animation utilities
        '.animate-premium': {
          animation: 'premium-fade-in 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        
        // Premium typography utilities
        '.font-geist': {
          fontFamily: theme('fontFamily.geist'),
        },
        '.font-geist-mono': {
          fontFamily: theme('fontFamily.geist-mono'),
        },
        
        // Premium spacing utilities
        '.space-premium': {
          '& > * + *': {
            marginTop: theme('spacing.4'),
          },
        },
        
        // Premium rounded utilities
        '.rounded-premium': {
          borderRadius: theme('borderRadius.2xl'),
        },
        
        // Premium transition utilities
        '.transition-premium': {
          transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      }
      
      addUtilities(newUtilities)
    }
  ],
}

