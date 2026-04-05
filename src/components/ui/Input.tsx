import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function Input({ label, className = "", ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-2 w-full">
      {label && (
        <label className="text-text-secondary text-sm font-semibold">{label}</label>
      )}
      <input
        className={`bg-bg-input border border-border text-text-primary rounded-xl min-h-12 px-4 text-base placeholder:text-text-hint focus:outline-none focus:border-text-accent focus:ring-1 focus:ring-text-accent/30 w-full transition-colors ${className}`}
        {...props}
      />
    </div>
  );
}
