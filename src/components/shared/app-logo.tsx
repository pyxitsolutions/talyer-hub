import { APP_LOGO_PATH } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** App-wide logo — plain img avoids Next.js image cache. */

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-16 w-16",
  xl: "h-20 w-20",
} as const;

const sizePixels = {
  sm: 32,
  md: 40,
  lg: 64,
  xl: 80,
} as const;

interface AppLogoProps {
  alt: string;
  size?: keyof typeof sizeClasses;
  className?: string;
}

export function AppLogo({ alt, size = "md", className }: AppLogoProps) {
  return (
    <img
      src={APP_LOGO_PATH}
      alt={alt}
      width={sizePixels[size]}
      height={sizePixels[size]}
      className={cn(sizeClasses[size], "shrink-0 rounded-xl object-contain", className)}
    />
  );
}
