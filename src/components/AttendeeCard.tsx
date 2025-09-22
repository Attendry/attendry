"use client";
import { useState } from "react";

export default function AttendeeCard({ person }: { person: any }) {
  const [busy, setBusy] = useState(false);
  const label = [person.name, person.org].filter(Boolean).join(" — ");

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/watchlist/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "attendee",
          label,
          ref_id: person.profile_url || (person.name + (person.org ? `|${person.org}` : "")),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
    } catch (e: any) {
      alert(e.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border p-3 bg-white">
      <div className="font-medium">{person.name}</div>
      {person.title && <div className="text-sm text-gray-700">{person.title}</div>}
      {person.org && <div className="text-sm text-gray-600">{person.org}</div>}
      <div className="mt-2 flex gap-2">
        {person.profile_url && (
          <a className="text-xs underline" href={person.profile_url} target="_blank" rel="noreferrer">
            Profile
          </a>
        )}
        <button
          onClick={save}
          disabled={busy}
          className="text-xs rounded-full border px-2 py-0.5 hover:bg-gray-50 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
