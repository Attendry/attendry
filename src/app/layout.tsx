import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui" }}>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
