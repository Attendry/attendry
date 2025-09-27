import "./globals.css";
import { Layout } from "@/components/Layout";
import { ComponentPreloader } from "@/lib/dynamic-imports";
import { performanceMonitor } from "@/lib/performance-monitor";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Preload critical components
  if (typeof window !== 'undefined') {
    ComponentPreloader.preloadLayoutComponents();
  }

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui" }}>
        <Layout>
          {children}
        </Layout>
      </body>
    </html>
  );
}
