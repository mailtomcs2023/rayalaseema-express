import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Admin | Rayalaseema Express CMS",
  description: "Content Management System for Rayalaseema Express",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
