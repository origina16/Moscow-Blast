import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentProfile } from "@/lib/auth";
import { signOutAction } from "@/app/actions/auth";

export const metadata: Metadata = {
  title: "Moscow Blast — статистика турниров CS2",
  description: "Платформа статистики турниров по CS2: демки, матчи, игроки.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await getCurrentProfile();

  return (
    <html lang="ru">
      <body className="min-h-screen antialiased">
        <header className="border-b border-slate-800 bg-slate-950/80">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="text-xl font-black tracking-tight text-orange-500">
              MOSCOW<span className="text-slate-100">BLAST</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              <Link href="/tournaments" className="text-slate-300 hover:text-white">
                Турниры
              </Link>
              <Link href="/players" className="text-slate-300 hover:text-white">
                Игроки
              </Link>
              {profile ? (
                <>
                  {profile.role === "organizer" && (
                    <Link href="/organizer" className="text-orange-400 hover:text-orange-300">
                      Кабинет организатора
                    </Link>
                  )}
                  <form action={signOutAction}>
                    <button className="btn-secondary text-sm">Выход</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-slate-300 hover:text-white">
                    Вход
                  </Link>
                  <Link href="/register" className="btn text-sm">
                    Регистрация
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mt-12 border-t border-slate-800 py-6 text-center text-xs text-slate-500">
          Moscow Blast · платформа статистики турниров CS2
        </footer>
      </body>
    </html>
  );
}
