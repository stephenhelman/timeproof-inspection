import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function Input({ label, className = "", ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-gray-300 text-sm font-medium">{label}</label>
      )}
      <input
        className={`bg-gray-800 border border-gray-700 text-white rounded-xl min-h-12 px-4 text-base placeholder:text-gray-500 focus:outline-none focus:border-blue-500 w-full ${className}`}
        {...props}
      />
    </div>
  );
}
