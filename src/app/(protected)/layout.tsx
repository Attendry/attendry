import { Layout } from "@/components/Layout";
import { PermissionsProvider } from "@/context/PermissionsContext";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <PermissionsProvider>
      <Layout>{children}</Layout>
    </PermissionsProvider>
  );
}
