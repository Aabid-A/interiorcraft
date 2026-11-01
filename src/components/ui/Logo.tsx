"use client";

import { useId, type SVGProps } from "react";
import { cn } from "@/lib/utils";

type LogoProps = SVGProps<SVGSVGElement> & { title?: string };

export function Logo({ className, title, ...props }: LogoProps) {
  const id = useId();
  const gradientId = `makan-bg-${id}`;
  const titleId = `makan-title-${id}`;
  const labelled = Boolean(title || props["aria-label"] || props["aria-labelledby"]);

  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("h-8 w-8 shrink-0", className)}
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : true}
      aria-labelledby={title ? titleId : undefined}
      {...props}
    >
      {title && <title id={titleId}>{title}</title>}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#064e3b" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill={`url(#${gradientId})`} />
      <path d="M50 28 L78 42 L50 56 L22 42 Z" fill="#34d399" opacity="0.85" />
      <path d="M22 42 L50 56 L50 82 L22 68 Z" fill="#10b981" opacity="0.95" />
      <path d="M78 42 L50 56 L50 82 L78 68 Z" fill="#059669" opacity="0.75" />
      <circle cx="50" cy="48" r="4" fill="white" opacity="0.9" />
      <path d="M50 48 L50 65" stroke="white" strokeWidth="1.5" strokeDasharray="2,2" opacity="0.8" />
    </svg>
  );
}

export default Logo;
