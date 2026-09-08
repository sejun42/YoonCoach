"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, Scale, Settings2 } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";

export const trackerTabs = [
  { href: "/weights", label: "체중", icon: Scale },
  { href: "/body-parts", label: "부위", icon: Dumbbell },
  { href: "/settings", label: "설정", icon: Settings2 }
] as const;

export default function AppShell({ children, onNavigate }: { children: ReactNode; onNavigate?: (href: string) => void }) {
  const pathname = usePathname();
  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (!onNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onNavigate(href);
  }
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link href="/weights" prefetch={onNavigate ? false : undefined} onClick={(event) => navigate(event, "/weights")} className="brand">
          <Image src="/icon.svg" width={30} height={30} alt="" priority />
          <span>YoonCoach</span>
        </Link>
        <span className="brand-note">나의 운동 기록</span>
      </header>
      <main id="main-content">{children}</main>
      <nav className="bottom-nav" aria-label="주 메뉴">
        <div className="nav-inner">
          {trackerTabs.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} prefetch={onNavigate ? false : undefined} onClick={(event) => navigate(event, href)}
              aria-current={pathname === href ? "page" : undefined} className="nav-link">
              <Icon size={21} strokeWidth={pathname === href ? 2.3 : 1.7} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
