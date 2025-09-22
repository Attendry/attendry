// src/components/AuthBadge.tsx
"use client";
import { useEffect, useState } from "react";

export default function AuthBadge() {
  const [state, setState] = useState<null | { id: string; email: string }>(null);
  useEffect(() => {
    fetch("/api/auth/whoami").then(r => r.json()).then(d => setState(d.user));
  }, []);
  return (
    <span className="text-xs px-2 py-1 rounded border bg-white">
      {state ? `Signed in: ${state.email}` : "Signed out"}
    </span>
  );
}
