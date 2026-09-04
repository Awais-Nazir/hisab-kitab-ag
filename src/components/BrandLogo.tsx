import Image from "next/image";
import Link from "next/link";

interface BrandLogoProps {
  variant?: "icon" | "horizontal" | "mark";
  size?: number;
  className?: string;
  href?: string | null;
  showText?: boolean;
}

export function BrandLogo({
  variant = "mark",
  size = 34,
  className = "",
  href = "/dashboard",
  showText = false,
}: BrandLogoProps) {
  const content = (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {variant === "horizontal" ? (
        <Image
          src="/logo-horizontal.png"
          alt="Hisab Kitab"
          width={size * 4.28}
          height={size}
          className="h-auto object-contain"
          priority
        />
      ) : variant === "icon" ? (
        <Image
          src="/icon-192.png"
          alt="Hisab Kitab"
          width={size}
          height={size}
          className="rounded-xl object-contain shadow-xs"
          priority
        />
      ) : (
        <Image
          src="/logo-mark.png"
          alt="Hisab Kitab"
          width={size}
          height={size}
          className="object-contain drop-shadow-xs"
          priority
        />
      )}
      {showText && (
        <span className="font-serif font-bold text-2xl tracking-tight text-[#162B27] dark:text-white">
          Hisab Kitab
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="group inline-flex items-center">
        {content}
      </Link>
    );
  }

  return content;
}
