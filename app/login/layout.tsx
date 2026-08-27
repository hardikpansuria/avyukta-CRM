import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "superLight CRM",
  description: "Sign in to your superLight CRM workspace",
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
