/**
 * Design Tokens System
 * 
 * Centralized design tokens for consistent theming across the application.
 * Supports light/dark modes and accessibility requirements.
 */

export const designTokens = {
  colors: {
    // Light theme
    light: {
      'bg-primary': '0 0% 100%',
      'bg-secondary': '0 0% 98%',
      'bg-surface': '0 0% 100%',
      'bg-overlay': '0 0% 0% / 0.5',
      'surface': '0 0% 100%',
      'surface-alt': '0 0% 98%',
      'surface-elevated': '0 0% 100%',
      'border': '0 0% 89%',
      'border-muted': '0 0% 95%',
      'border-strong': '0 0% 80%',
      'primary': '221 83% 53%',
      'primary-foreground': '0 0% 100%',
      'primary-muted': '221 83% 95%',
      'positive': '142 76% 36%',
      'positive-foreground': '0 0% 100%',
      'warn': '38 92% 50%',
      'warn-foreground': '0 0% 100%',
      'danger': '0 84% 60%',
      'danger-foreground': '0 0% 100%',
      'text-primary': '0 0% 9%',
      'text-secondary': '0 0% 45%',
      'text-muted': '0 0% 64%',
      'text-disabled': '0 0% 80%',
    },
    // Dark theme
    dark: {
      'bg-primary': '0 0% 9%',
      'bg-secondary': '0 0% 11%',
      'bg-surface': '0 0% 9%',
      'bg-overlay': '0 0% 0% / 0.8',
      'surface': '0 0% 9%',
      'surface-alt': '0 0% 11%',
      'surface-elevated': '0 0% 13%',
      'border': '0 0% 20%',
      'border-muted': '0 0% 15%',
      'border-strong': '0 0% 30%',
      'primary': '221 83% 53%',
      'primary-foreground': '0 0% 100%',
      'primary-muted': '221 83% 20%',
      'positive': '142 76% 36%',
      'positive-foreground': '0 0% 100%',
      'warn': '38 92% 50%',
      'warn-foreground': '0 0% 100%',
      'danger': '0 84% 60%',
      'danger-foreground': '0 0% 100%',
      'text-primary': '0 0% 98%',
      'text-secondary': '0 0% 70%',
      'text-muted': '0 0% 50%',
      'text-disabled': '0 0% 40%',
    },
  },
  spacing: {
    '0': '0px',
    '1': '0.25rem',
    '2': '0.5rem',
    '3': '0.75rem',
    '4': '1rem',
    '5': '1.25rem',
    '6': '1.5rem',
    '8': '2rem',
    '10': '2.5rem',
    '12': '3rem',
    '16': '4rem',
    '20': '5rem',
    '24': '6rem',
    '32': '8rem',
  },
  borderRadius: {
    'sm': '0.25rem',
    'md': '0.375rem',
    'lg': '0.5rem',
    'xl': '0.75rem',
    '2xl': '1rem',
  },
  shadows: {
    'elevation-0': 'none',
    'elevation-1': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    'elevation-2': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    'elevation-3': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  },
  typography: {
    fontFamily: {
      sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      mono: ['ui-monospace', 'SFMono-Regular', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
    },
    fontSize: {
      xs: ['0.75rem', { lineHeight: '1rem' }],
      sm: ['0.875rem', { lineHeight: '1.25rem' }],
      base: ['1rem', { lineHeight: '1.5rem' }],
      md: ['1.125rem', { lineHeight: '1.75rem' }],
      lg: ['1.25rem', { lineHeight: '1.75rem' }],
      xl: ['1.5rem', { lineHeight: '2rem' }],
      '2xl': ['1.875rem', { lineHeight: '2.25rem' }],
      '3xl': ['2.25rem', { lineHeight: '2.5rem' }],
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },
  animation: {
    duration: {
      fast: '150ms',
      normal: '200ms',
      slow: '300ms',
    },
    easing: {
      easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
} as const;

// Type definitions for design tokens
export type ColorToken = keyof typeof designTokens.colors.light;
export type SpacingToken = keyof typeof designTokens.spacing;
export type BorderRadiusToken = keyof typeof designTokens.borderRadius;
export type ShadowToken = keyof typeof designTokens.shadows;
export type FontSizeToken = keyof typeof designTokens.typography.fontSize;
export type FontWeightToken = keyof typeof designTokens.typography.fontWeight;

// Utility functions for working with design tokens
export const getColorValue = (token: ColorToken, theme: 'light' | 'dark' = 'light') => {
  return designTokens.colors[theme][token];
};

export const getSpacingValue = (token: SpacingToken) => {
  return designTokens.spacing[token];
};

export const getBorderRadiusValue = (token: BorderRadiusToken) => {
  return designTokens.borderRadius[token];
};

export const getShadowValue = (token: ShadowToken) => {
  return designTokens.shadows[token];
};

// CSS custom properties generator
export const generateCSSVariables = (theme: 'light' | 'dark' = 'light') => {
  const colors = designTokens.colors[theme];
  const cssVars: Record<string, string> = {};
  
  Object.entries(colors).forEach(([key, value]) => {
    cssVars[`--${key}`] = value;
  });
  
  return cssVars;
};

export default designTokens;
