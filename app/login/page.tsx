"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  Building2Icon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  FileTextIcon,
  LockKeyholeIcon,
  MailIcon,
  ShieldCheckIcon,
} from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-state";

export default function LoginPage() {
  const [orgCode, setOrgCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));

    if (hashParams.get("type") === "invite") {
      window.location.replace(`/auth/reset-password${hash}`);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          org_code: orgCode,
          email,
          password,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to sign in.");
        return;
      }

      // Authentication changes the HTTP-only Supabase and organization cookies.
      // A client-side navigation can reuse a dashboard layout rendered for the
      // previous user, so cross the auth boundary with a fresh document request.
      window.location.replace("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[minmax(360px,0.85fr)_minmax(0,1.15fr)] dark:bg-zinc-950">
      <section className="relative hidden min-h-screen flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-white lg:flex xl:p-14">
        <div>
          <div className="flex items-center gap-3">
            <Image
              src="/superlight-crm-logo.png"
              alt=""
              width={64}
              height={64}
              className="size-16 shrink-0 object-contain"
              priority
            />
            <div>
              <p className="text-base font-semibold">superLight CRM</p>
              <p className="mt-0.5 text-xs text-zinc-400">
                Customer operations workspace
              </p>
            </div>
          </div>

          <div className="mt-20 max-w-md">
            <p className="text-xs font-medium uppercase text-emerald-400">
              One workspace
            </p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight">
              Keep customer work, quotations, and follow-ups in clear view.
            </h1>
            <p className="mt-5 text-sm leading-6 text-zinc-400">
              A focused operating system for sales teams that need accurate
              records and dependable handoffs.
            </p>
          </div>

          <div className="mt-12 space-y-3">
            <LoginFeature
              icon={<Building2Icon />}
              label="Customer records and activity"
            />
            <LoginFeature
              icon={<FileTextIcon />}
              label="Quotation building and pricing"
            />
            <LoginFeature
              icon={<ShieldCheckIcon />}
              label="Organization-scoped access"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-zinc-800 pt-6 text-xs text-zinc-500">
          <CheckIcon className="size-3.5 text-emerald-400" />
          Secure workspace access
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <Image
              src="/superlight-crm-logo.png"
              alt=""
              width={64}
              height={64}
              className="size-16 shrink-0 object-contain"
              priority
            />
            <div>
              <p className="font-semibold text-zinc-950 dark:text-zinc-50">
                superLight CRM
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Customer operations workspace
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Welcome back
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
              Sign in to your workspace
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Use your organization code and account credentials.
            </p>
          </div>

          <aside className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="flex items-start gap-3">
              <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
              <div>
                <h3 className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                  Your business data stays yours.
                </h3>
                <p className="mt-2 text-xs leading-5 text-emerald-900/80 dark:text-emerald-100/80">
                  Avyukta CRM uses Client Data only to operate, secure and
                  support the service. We do not sell Client Data or use it for
                  third-party advertising. Essential cookies are used for
                  authentication and session security.
                </p>
                <p className="mt-2 text-xs leading-5 text-emerald-900/80 dark:text-emerald-100/80">
                  Pilot privacy framework: PIPEDA fair-information principles.
                  This is not a certification.
                </p>
              </div>
            </div>
          </aside>

          {error ? (
            <Alert
              className="mt-6 rounded-md border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30"
              variant="destructive"
            >
              <AlertTitle>Sign in failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <form
            aria-busy={isLoading}
            className="mt-8 space-y-5"
            onSubmit={handleSubmit}
          >
            <div>
              <Label
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
                htmlFor="org-code"
                required
              >
                Organization Code
              </Label>
              <div className="relative mt-2">
                <Building2Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  autoComplete="organization"
                  className="h-11 rounded-md border-zinc-300 bg-white pl-10 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  id="org-code"
                  name="org_code"
                  placeholder="Enter organization code"
                  required
                  value={orgCode}
                  onChange={(event) => setOrgCode(event.target.value)}
                />
              </div>
            </div>

            <div>
              <Label
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
                htmlFor="email"
                required
              >
                Email Address
              </Label>
              <div className="relative mt-2">
                <MailIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  autoComplete="email"
                  className="h-11 rounded-md border-zinc-300 bg-white pl-10 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  id="email"
                  name="email"
                  placeholder="name@company.com"
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-4">
                <Label
                  className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
                  htmlFor="password"
                  required
                >
                  Password
                </Label>
                <Link
                  className="text-xs font-medium text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
                  href="/forgot-password"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative mt-2">
                <LockKeyholeIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  autoComplete="current-password"
                  className="h-11 rounded-md border-zinc-300 bg-white pr-11 pl-10 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  id="password"
                  name="password"
                  placeholder="Enter your password"
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <Button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute top-1/2 right-1.5 size-8 -translate-y-1/2 rounded-md text-zinc-500"
                  size="icon-sm"
                  title={showPassword ? "Hide password" : "Show password"}
                  type="button"
                  variant="ghost"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </Button>
              </div>
            </div>

            <Button
              className="h-11 w-full rounded-md font-semibold"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>

            <p className="text-center text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              By signing in, you agree to the{" "}
              <Link className="underline hover:text-zinc-950 dark:hover:text-zinc-50" href="/legal/terms">
                Authorized User Terms
              </Link>{" "}
              and acknowledge the{" "}
              <Link className="underline hover:text-zinc-950 dark:hover:text-zinc-50" href="/legal/privacy">
                CRM Privacy Notice
              </Link>
              .
            </p>
          </form>

          <nav aria-label="Legal and privacy" className="mt-8">
            <ul className="flex flex-wrap justify-center gap-x-3 gap-y-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
              <li><Link className="hover:text-zinc-950 hover:underline dark:hover:text-zinc-50" href="/legal/privacy">Privacy Notice</Link></li>
              <li aria-hidden="true">|</li>
              <li><Link className="hover:text-zinc-950 hover:underline dark:hover:text-zinc-50" href="/legal/terms">Authorized User Terms</Link></li>
              <li aria-hidden="true">|</li>
              <li><Link className="hover:text-zinc-950 hover:underline dark:hover:text-zinc-50" href="/security">Security</Link></li>
              <li aria-hidden="true">|</li>
              <li><Link className="hover:text-zinc-950 hover:underline dark:hover:text-zinc-50" href="/legal/cookies">Cookie Notice</Link></li>
              <li aria-hidden="true">|</li>
              <li><Link className="hover:text-zinc-950 hover:underline dark:hover:text-zinc-50" href="/legal/subprocessors">Subprocessors</Link></li>
              <li aria-hidden="true">|</li>
              <li><Link className="hover:text-zinc-950 hover:underline dark:hover:text-zinc-50" href="/legal/privacy#contact">Contact Privacy Officer</Link></li>
            </ul>
          </nav>
          <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
            Access is limited to active organization members.
          </p>
        </div>
      </section>
    </main>
  );
}

function LoginFeature({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <span className="flex size-8 items-center justify-center rounded-md bg-zinc-800 text-zinc-300 [&_svg]:size-4">
        {icon}
      </span>
      <span className="text-sm text-zinc-300">{label}</span>
    </div>
  );
}
