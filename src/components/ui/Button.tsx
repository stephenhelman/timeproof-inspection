import React from "react";

type Variant = "primary" | "ghost" | "danger" | "success";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand-blue hover:bg-accent-blue-hover text-text-primary font-semibold",
  ghost: "border border-border text-text-secondary hover:text-text-primary hover:border-border-hover",
  danger: "bg-brand-red hover:bg-accent-red-hover text-text-primary font-semibold",
  success: "bg-success hover:bg-success text-text-primary font-semibold",
};

export default function Button({
  variant = "primary",
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={`rounded-xl min-h-12 px-6 text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
