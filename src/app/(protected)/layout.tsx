import { Layout } from "@/components/Layout";
import { PermissionsProvider } from "@/context/PermissionsContext";
import { SearchResultsProvider } from "@/context/SearchResultsContext";
import { Toaster } from "sonner";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <PermissionsProvider>
      <SearchResultsProvider>
        <Layout>{children}</Layout>
        <Toaster position="top-right" />
      </SearchResultsProvider>
    </PermissionsProvider>
  );
}
