import Link from "next/link";

export default function DesignsIndex() {
  const designs = [
    { href: "/designs/minimal", title: "Minimal Sidebar + Top Bar" },
    { href: "/designs/cards", title: "Card Canvas" },
    { href: "/designs/split", title: "Split Navigation" },
    { href: "/designs/dark", title: "Action Dock (Dark Mode)" },
    { href: "/designs/focus", title: "Focus Mode" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Design Previews</h1>
        <p className="text-slate-600 mb-8">Explore alternative layouts without changing the core app. Each preview is full-screen and isolated.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {designs.map((d) => (
            <Link key={d.href} href={d.href} className="block p-4 rounded-lg border border-slate-200 bg-white hover:shadow-sm transition-shadow">
              <div className="text-lg font-semibold text-slate-900">{d.title}</div>
              <div className="text-sm text-slate-500 mt-1">{d.href}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}


