"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "New" },
  { href: "/applications", label: "History" },
  { href: "/profile", label: "Profile" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col">
      <header className="px-4 pt-5 pb-1">
        <p className="font-heading text-[1.7rem] leading-tight tracking-tight">Job Application Agent</p>
      </header>
      <main className="flex-1 px-4 pt-4 pb-24">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur">
        <ul className="mx-auto grid max-w-xl grid-cols-3">
          {links.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`flex h-14 items-center justify-center text-sm ${
                    active ? "font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
