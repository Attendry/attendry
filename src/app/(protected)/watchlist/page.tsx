"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Watchlist page - Redirects to /contacts
 * This page has been replaced by the new /contacts page with enhanced contact management features.
 */
export default function Watchlist() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new contacts page
    router.replace("/contacts");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-slate-600">Redirecting to Contacts...</p>
      </div>
    </div>
  );
}