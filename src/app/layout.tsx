import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Around Duke — Find your next campus moment",
  description:
    "Explore Duke campus events, one place at a time. An independent student project powered by the Duke event calendar.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
