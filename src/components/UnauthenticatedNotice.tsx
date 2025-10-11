import Link from "next/link";

interface UnauthenticatedNoticeProps {
  feature: string;
  description?: string;
  className?: string;
  loginHref?: string;
}

export function UnauthenticatedNotice({
  feature,
  description,
  className,
  loginHref = "/login",
}: UnauthenticatedNoticeProps) {
  return (
    <div
      className={`rounded-lg border border-dashed border-slate-300 bg-white/80 p-6 text-center shadow-sm backdrop-blur ${className ?? ""}`}
    >
      <h2 className="text-lg font-semibold text-slate-900">
        {`Sign in to unlock ${feature}`}
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        {description ?? "Log in to activate saved preferences and personalized insights."}
      </p>
      <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2">
        <Link
          href={loginHref}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          Go to login
        </Link>
        <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          Explore the demo
        </Link>
      </div>
    </div>
  );
}


