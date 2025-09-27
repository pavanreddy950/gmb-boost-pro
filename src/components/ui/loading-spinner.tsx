import React from "react"
import { cn } from "@/lib/utils"

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl"
  variant?: "default" | "primary" | "secondary"
}

const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ className, size = "md", variant = "default", ...props }, ref) => {
    const sizeClasses = {
      sm: "h-4 w-4 border-2",
      md: "h-6 w-6 border-2", 
      lg: "h-8 w-8 border-2",
      xl: "h-12 w-12 border-3"
    }

    const variantClasses = {
      default: "border-muted-foreground border-t-transparent",
      primary: "border-primary border-t-transparent", 
      secondary: "border-secondary border-t-transparent"
    }

    return (
      <div
        ref={ref}
        className={cn(
          "animate-spin rounded-full",
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        {...props}
      />
    )
  }
)

LoadingSpinner.displayName = "LoadingSpinner"

export { LoadingSpinner }