import type { Metadata } from "next";
import "./globals.css";
import PWARegister from "@/components/PWARegister";

export const metadata: Metadata = {
  title: "다이어트 매크로 코치",
  description: "체중 추세 기반 자동 코칭 PWA",
  manifest: "/manifest.webmanifest"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
