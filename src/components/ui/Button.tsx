import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
    size?: 'sm' | 'md' | 'lg' | 'icon'
    isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
        const variants = {
            primary: 'bg-brand-gradient text-white shadow-lg shadow-primary/25 hover:translate-y-[-2px] hover:shadow-xl hover:shadow-primary/30',
            secondary: 'bg-card border border-border text-foreground hover:bg-card-hover hover:border-primary/50',
            outline: 'border border-border hover:border-primary/50 hover:bg-card-hover text-foreground',
            ghost: 'hover:bg-primary/10 text-primary',
            danger: 'bg-error/10 text-error border border-error/20 hover:bg-error/20',
        }

        const sizes = {
            sm: 'px-3 py-1.5 text-xs',
            md: 'px-6 py-3',
            lg: 'px-8 py-4 text-lg',
            icon: 'p-2',
        }

        return (
            <button
                className={cn(
                    'relative inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
                    variants[variant],
                    size !== 'icon' && sizes[size as keyof typeof sizes],
                    size === 'icon' && sizes.icon,
                    className
                )}
                ref={ref}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading ? (
                    <>
                        <span className="opacity-0">{children}</span>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        </div>
                    </>
                ) : (
                    children
                )}
            </button>
        )
    }
)
Button.displayName = "Button"

export { Button }
