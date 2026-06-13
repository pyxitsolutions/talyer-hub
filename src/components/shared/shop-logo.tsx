"use client";

import { Wrench } from "lucide-react";
import Image from "next/image";

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
    <div
      className={cn(
        boxClass,
        "flex items-center justify-center rounded-lg bg-primary text-primary-foreground",
        iconClassName
      )}
    >
      <Wrench
        className={cn(
          size === "lg" ? "h-7 w-7" : size === "md" ? "h-5 w-5" : "h-4 w-4"
        )}
      />
    </div>
  );
}
