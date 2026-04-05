import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export function Badge({ children, color = "#FF2C2C", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full text-white ${className}`}
      style={{ backgroundColor: color }}
    >
      {children}
    </span>
  );
}
