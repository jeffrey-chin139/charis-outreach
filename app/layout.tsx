import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Charis Outreach",
  description: "Mobile outreach recording for Charis Outreach volunteers."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
