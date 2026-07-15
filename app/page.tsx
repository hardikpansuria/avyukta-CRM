import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
        <h1 className="text-2xl font-bold text-slate-900">
          Avyukta CRM
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          Choose a login option.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-slate-900 px-4 py-3 text-center text-white"
          >
            Organization Login
          </Link>

          <Link
            href="/super-admin/login"
            className="rounded-lg border border-slate-300 px-4 py-3 text-center text-slate-900"
          >
            Super Admin Login
          </Link>
        </div>
      </div>
    </main>
  );
}
