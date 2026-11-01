import Link from "next/link";
import { Logo as BrandMark } from "@/components/ui/Logo";

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return <BrandMark className={className} style={{ width: size, height: size }} />;
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={"text-slate-900 font-bold tracking-tight " + (className ?? "")}>Makan3D</span>;
}

export default function Logo({ href = "/", compact, size = 26 }: { href?: string; compact?: boolean; size?: number }) {
  return (
    <Link href={href} className="logo" aria-label="Makan3D home">
      <LogoMark size={size} />
      {!compact && <Wordmark />}
    </Link>
  );
}
