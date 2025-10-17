import { Layout } from "@/components/Layout";
import { PermissionsProvider } from "@/context/PermissionsContext";
import { SearchResultsProvider } from "@/context/SearchResultsContext";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <PermissionsProvider>
      <SearchResultsProvider>
        <Layout>{children}</Layout>
      </SearchResultsProvider>
    </PermissionsProvider>
  );
}
