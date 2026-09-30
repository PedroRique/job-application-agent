import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-app-sans",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-app-serif",
});

export const metadata: Metadata = {
  title: "Job Application Agent",
  description: "Review a job, match it to your profile, and send the application from Hotmail.",
  applicationName: "Job Application Agent",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
