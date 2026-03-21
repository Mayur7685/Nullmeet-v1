"use client";

interface NullmeetLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function NullmeetLogo({ size = "md", className = "" }: NullmeetLogoProps) {
  const sizes = {
    sm: { text: "text-lg" },
    md: { text: "text-3xl" },
    lg: { text: "text-5xl" },
  };

  const s = sizes[size];

  return (
    <span className={`inline-flex items-center ${className}`}>
      <span className={`${s.text} font-bold tracking-tight`}>
        <span className="text-[var(--foreground)]">null</span>
        <span className="text-purple-500">meet</span>
      </span>
    </span>
  );
}
