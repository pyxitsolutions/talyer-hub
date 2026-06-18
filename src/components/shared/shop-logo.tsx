"use client";

import Image from "next/image";

import { AppLogo } from "@/components/shared/app-logo";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-16 w-16",
} as const;

interface ShopLogoProps {
  logoUrl?: string | null;
  alt?: string;
  size?: keyof typeof sizeClasses;
  className?: string;
  iconClassName?: string;
}

export function ShopLogo({
  logoUrl,
  alt = "Shop logo",
  size = "md",
  className,
  iconClassName,
}: ShopLogoProps) {
  const boxClass = cn(sizeClasses[size], "shrink-0", className);

  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={alt}
        width={size === "lg" ? 64 : size === "md" ? 40 : 32}
        height={size === "lg" ? 64 : size === "md" ? 40 : 32}
        className={cn(boxClass, "rounded-lg object-contain")}
        unoptimized
      />
    );
  }

  return (
    <AppLogo
      alt={alt}
      size={size}
      className={cn(boxClass, "rounded-lg", iconClassName)}
    />
  );
}
