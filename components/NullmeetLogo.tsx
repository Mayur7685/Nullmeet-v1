"use client";

interface NullmeetLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function NullmeetLogo({ size = "md", className = "" }: NullmeetLogoProps) {
  const sizes = {
    sm: { icon: 20, text: "text-lg", gap: "gap-1.5" },
    md: { icon: 32, text: "text-3xl", gap: "gap-2" },
    lg: { icon: 48, text: "text-5xl", gap: "gap-3" },
  };

  const s = sizes[size];

  return (
    <span className={`inline-flex items-center ${s.gap} ${className}`}>
      {/* ∅ null symbol as logo mark */}
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="logo-gradient" x1="2" y1="2" x2="22" y2="22">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        <path
          fill="url(#logo-gradient)"
          d="M12 2c1.85 0 3.55.78 4.9 2.1l1.7-2.17l1.58 1.23l-1.98 2.52C19.33 7.41 20 9.6 20 12c0 5.5-3.58 10-8 10c-1.85 0-3.55-.78-4.9-2.1l-1.7 2.17l-1.58-1.23l1.98-2.52C4.67 16.59 4 14.4 4 12C4 6.5 7.58 2 12 2m0 2c-3.31 0-6 3.58-6 8c0 1.73.41 3.33 1.11 4.64l8.56-10.97C14.66 4.62 13.38 4 12 4m0 16c3.31 0 6-3.58 6-8c0-1.73-.41-3.33-1.11-4.64L8.33 18.33C9.34 19.38 10.62 20 12 20"
        />
      </svg>
      <span className={`${s.text} font-bold tracking-tight`}>
        <span className="text-[var(--foreground)]">null</span>
        <span className="text-purple-500">meet</span>
      </span>
    </span>
  );
}
