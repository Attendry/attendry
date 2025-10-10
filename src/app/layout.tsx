import "./globals.css";
import { Layout } from "@/components/Layout";
import { PermissionsProvider } from "@/context/PermissionsContext";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui" }}>
        <PermissionsProvider>
          <Layout>{children}</Layout>
        </PermissionsProvider>
      </body>
    </html>
  );
}
