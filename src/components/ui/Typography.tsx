import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Typography Component
 * 
 * Standardized typography components for consistent visual hierarchy
 * across the application.
 */

export interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode
  className?: string
}

/**
 * Heading1 - Page titles
 * text-2xl font-bold (24px, 700)
 */
export const Heading1 = React.forwardRef<HTMLHeadingElement, TypographyProps>(
  ({ className, children, ...props }, ref) => (
    <h1
      ref={ref}
      className={cn("text-2xl font-bold text-slate-900", className)}
      {...props}
    >
      {children}
    </h1>
  )
)
Heading1.displayName = "Heading1"

/**
 * Heading2 - Section headers
 * text-xl font-semibold (20px, 600)
 */
export const Heading2 = React.forwardRef<HTMLHeadingElement, TypographyProps>(
  ({ className, children, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn("text-xl font-semibold text-slate-800", className)}
      {...props}
    >
      {children}
    </h2>
  )
)
Heading2.displayName = "Heading2"

/**
 * Heading3 - Card titles
 * text-lg font-medium (18px, 500)
 */
export const Heading3 = React.forwardRef<HTMLHeadingElement, TypographyProps>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-lg font-medium text-slate-700", className)}
      {...props}
    >
      {children}
    </h3>
  )
)
Heading3.displayName = "Heading3"

/**
 * Body - Standard body text
 * text-base font-normal (16px, 400)
 */
export const Body = React.forwardRef<HTMLParagraphElement, TypographyProps>(
  ({ className, children, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-base font-normal text-slate-600", className)}
      {...props}
    >
      {children}
    </p>
  )
)
Body.displayName = "Body"

