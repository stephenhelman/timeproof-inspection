import React from "react";

type Variant = "primary" | "ghost" | "danger" | "success";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-blue-600 hover:bg-blue-500 text-white font-semibold",
  ghost: "border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500",
  danger: "bg-red-600 hover:bg-red-500 text-white font-semibold",
  success: "bg-green-600 hover:bg-green-500 text-white font-semibold",
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
