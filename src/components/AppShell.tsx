"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "오늘" },
  { href: "/weights", label: "체중" },
  { href: "/coaching", label: "코칭" },
  { href: "/settings", label: "설정" }
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="container pb-[120px] md:pb-[140px]">
      <header className="mb-4 pt-2">
        <h1 className="text-2xl font-black tracking-tight">다이어트 매크로 코치</h1>
        <p className="small">10초 루틴: 공복 체중 + 체크인</p>
      </header>
      <main>{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-md items-center justify-between px-6 py-2.5 sm:px-8">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-[68px] items-center justify-center rounded-xl px-3 py-2.5 text-[14px] font-bold transition-all ${active ? "bg-blue-50 text-blue-800" : "text-slate-400 hover:text-slate-800"
                  }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
