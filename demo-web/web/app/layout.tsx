import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inner Compass · VinUni Student Wellbeing",
  description: "A gentle, non-clinical self-reflection space for VinUni students.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
