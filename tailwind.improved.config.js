/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Improved Design Tokens
      colors: {
        // Background System
        'premium-bg': '#0B0F1A',
        'premium-surface': '#1A1F2C',
        'premium-border': '#2D3344',
        
        // Text System with improved hierarchy
        'premium-text-primary': '#E6E8EC',   // High contrast
        'premium-text-secondary': '#9CA3AF', // Medium contrast
        'premium-text-tertiary': '#6B7280',  // Low contrast
        
        // Accent System (use sparingly)
        'premium-accent': '#4ADE80',         // Neo-green primary
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
      
      // Improved Typography
      fontFamily: {
        'geist': ['Geist Sans', 'Inter', 'system-ui', 'sans-serif'],
        'geist-mono': ['Geist Mono', 'JetBrains Mono', 'monospace'],
      },
      
      fontSize: {
        // Improved typography scale
        'xs': ['0.6875rem', { lineHeight: '1rem', fontWeight: '600' }],    // 11px - captions
        'sm': ['0.75rem', { lineHeight: '1.125rem', fontWeight: '500' }],  // 12px - labels
        'base': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400' }], // 14px - body
        'lg': ['1rem', { lineHeight: '1.5rem', fontWeight: '500' }],       // 16px - secondary headings
        'xl': ['1.125rem', { lineHeight: '1.5rem', fontWeight: '600' }],   // 18px - secondary headings
        '2xl': ['1.25rem', { lineHeight: '1.5rem', fontWeight: '600' }],   // 20px - primary headings
      },
      
      // Improved Spacing Scale
      spacing: {
        '0.5': '0.125rem',  // 2px
        '1': '0.25rem',     // 4px
        '1.5': '0.375rem',  // 6px
        '2': '0.5rem',      // 8px
        '2.5': '0.625rem',  // 10px
        '3': '0.75rem',     // 12px
        '3.5': '0.875rem',  // 14px
        '4': '1rem',        // 16px
        '5': '1.25rem',     // 20px
        '6': '1.5rem',      // 24px
        '8': '2rem',        // 32px
        '10': '2.5rem',     // 40px
        '12': '3rem',       // 48px
        '16': '4rem',       // 64px
        '20': '5rem',       // 80px
      },
      
      // Improved Border Radius
      borderRadius: {
        'lg': '0.75rem',    // 12px
        'xl': '1rem',       // 16px
        '2xl': '1.25rem',   // 20px
        '3xl': '1.5rem',    // 24px
      },
      
      // Improved Shadows
      boxShadow: {
        'premium-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'premium-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'premium-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'premium-glow': '0 0 20px rgba(74, 222, 128, 0.15)',
        'premium-glow-secondary': '0 0 20px rgba(56, 189, 248, 0.15)',
      },
      
      // Improved Animation
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
      
      // Improved Transition
      transitionTimingFunction: {
        'premium': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      
      // Improved Z-Index
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
    // Improved utilities for premium design
    function({ addUtilities, theme }) {
      const newUtilities = {
        // Improved text utilities
        '.text-premium-primary': {
          color: theme('colors.premium-text-primary'),
          fontWeight: '400',
        },
        '.text-premium-secondary': {
          color: theme('colors.premium-text-secondary'),
          fontWeight: '500',
        },
        '.text-premium-tertiary': {
          color: theme('colors.premium-text-tertiary'),
          fontWeight: '500',
        },
        
        // Improved background utilities
        '.bg-premium': {
          backgroundColor: theme('colors.premium-bg'),
        },
        '.bg-premium-surface': {
          backgroundColor: theme('colors.premium-surface'),
        },
        
        // Improved border utilities
        '.border-premium': {
          borderColor: theme('colors.premium-border'),
        },
        
        // Improved accent utilities
        '.text-premium-accent': {
          color: theme('colors.premium-accent'),
          fontWeight: '600',
        },
        '.bg-premium-accent': {
          backgroundColor: theme('colors.premium-accent'),
        },
        '.border-premium-accent': {
          borderColor: theme('colors.premium-accent'),
        },
        
        // Improved hover utilities
        '.hover-premium': {
          '&:hover': {
            backgroundColor: theme('colors.premium-hover'),
          },
        },
        
        // Improved focus utilities
        '.focus-premium': {
          '&:focus': {
            borderColor: theme('colors.premium-accent'),
            boxShadow: `0 0 0 1px ${theme('colors.premium-accent')}`,
          },
        },
        
        // Improved glow utilities
        '.glow-premium': {
          boxShadow: theme('boxShadow.premium-glow'),
        },
        '.glow-premium-secondary': {
          boxShadow: theme('boxShadow.premium-glow-secondary'),
        },
        
        // Improved animation utilities
        '.animate-premium': {
          animation: 'premium-fade-in 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        
        // Improved typography utilities
        '.font-geist': {
          fontFamily: theme('fontFamily.geist'),
        },
        '.font-geist-mono': {
          fontFamily: theme('fontFamily.geist-mono'),
        },
        
        // Improved spacing utilities
        '.space-premium': {
          '& > * + *': {
            marginTop: theme('spacing.4'),
          },
        },
        
        // Improved rounded utilities
        '.rounded-premium': {
          borderRadius: theme('borderRadius.2xl'),
        },
        
        // Improved transition utilities
        '.transition-premium': {
          transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        
        // Touch target utilities
        '.touch-target': {
          minHeight: '44px',
          minWidth: '44px',
        },
        
        // Improved button utilities
        '.btn-premium': {
          padding: `${theme('spacing.3')} ${theme('spacing.6')}`,
          borderRadius: theme('borderRadius.xl'),
          fontWeight: '600',
          fontSize: theme('fontSize.sm'),
          transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        
        // Improved input utilities
        '.input-premium': {
          padding: `${theme('spacing.3.5')} ${theme('spacing.4')}`,
          borderRadius: theme('borderRadius.xl'),
          border: `1px solid ${theme('colors.premium-border')}`,
          backgroundColor: theme('colors.premium-bg'),
          color: theme('colors.premium-text-primary'),
          fontSize: theme('fontSize.sm'),
          fontWeight: '500',
          transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:focus': {
            borderColor: theme('colors.premium-accent'),
            boxShadow: `0 0 0 1px ${theme('colors.premium-accent')}`,
          },
        },
      }
      
      addUtilities(newUtilities)
    }
  ],
}
