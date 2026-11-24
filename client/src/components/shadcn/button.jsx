import * as React from "react"
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[16px] font-display text-[15px] font-normal tracking-[-0.012em] whitespace-nowrap transition-[transform,box-shadow,background-color,color] duration-150 ease-[cubic-bezier(0.2,0.715,0.205,0.99)] cursor-pointer hover:-translate-y-px active:translate-y-px outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "key--ink",
        ink: "key--ink",
        green: "key--green",
        key: "bg-card text-foreground shadow-[var(--shadow-key)]",
        glass: "glass text-foreground shadow-[var(--shadow-key)]",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "bg-card text-foreground shadow-[var(--shadow-key)]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-5.5 py-2 has-[>svg]:px-4.5",
        xs: "h-7 gap-1 rounded-full px-2.5 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-10 gap-1.5 rounded-[13px] px-4 text-[14px] has-[>svg]:px-3.5",
        lg: "h-[60px] rounded-[20px] px-8 text-[17px] has-[>svg]:px-7",
        xl: "h-[64px] rounded-[20px] px-9 text-[17px] has-[>svg]:px-8",
        icon: "size-12 rounded-[16px]",
        "icon-xs": "size-7 rounded-full [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-10 rounded-[13px]",
        "icon-lg": "size-[60px] rounded-[20px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
