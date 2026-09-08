"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SWRConfig } from "swr";
import AppShell, { trackerTabs } from "./AppShell";
import WeightsManager from "./WeightsManager";
import BodyPartCalendar from "./BodyPartCalendar";
import SettingsPanel from "./SettingsPanel";
import { requestJson } from "@/lib/tracker-client";

const screens = {
  "/weights": WeightsManager,
  "/body-parts": BodyPartCalendar,
  "/settings": SettingsPanel
};

export default function TrackerWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [visited, setVisited] = useState<string[]>([pathname]);
  const scrollPositions = useRef<Record<string, number>>({});
  const [cache] = useState(() => new Map());
  useLayoutEffect(() => {
    window.scrollTo({ top: scrollPositions.current[pathname] ?? 0, behavior: "instant" });
    const remember = () => { scrollPositions.current[pathname] = window.scrollY; };
    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
  }, [pathname]);

  if (!visited.includes(pathname)) setVisited([...visited, pathname]);

  function navigate(href: string) {
    if (href === pathname) return;
    scrollPositions.current[pathname] = window.scrollY;
    // These URLs share the authenticated layout; switching tabs needs no server round trip.
    window.history.pushState(null, "", href);
  }
  return (
    <SWRConfig value={{ provider: () => cache, fetcher: requestJson, dedupingInterval: 30000,
      focusThrottleInterval: 60000, errorRetryCount: 2, revalidateOnReconnect: true }}>
      <AppShell onNavigate={navigate}>
        {trackerTabs.map(({ href, label }) => {
          const Screen = screens[href];
          return (
            <div key={href} hidden={pathname !== href} data-screen={href} aria-label={label}>
              {(visited.includes(href) || pathname === href) && <Screen />}
            </div>
          );
        })}
        {children}
      </AppShell>
    </SWRConfig>
  );
}
