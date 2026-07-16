import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Avyukta CRM",
  description: "Multi-tenant CRM foundation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col antialiased">{children}</body>
    </html>
  );
}
