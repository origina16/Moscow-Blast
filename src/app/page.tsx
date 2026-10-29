import Link from "next/link";

export default function HomePage() {
  return (
    <section className="flex flex-col gap-8">
      <div className="card">
        <h1 className="text-4xl font-black tracking-tight">
          MOSCOW<span className="text-orange-500">BLAST</span>
        </h1>
        <p className="mt-3 max-w-2xl text-slate-300">
          Платформа статистики турниров по CS2. Организаторы создают турниры,
          добавляют участников и загружают демки Fastcup — сайт сам разбирает
          каждый матч и собирает статистику по каждому игроку.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/tournaments" className="btn">Смотреть турниры</Link>
          <Link href="/players" className="btn-secondary">Статистика игроков</Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <h2 className="text-lg font-bold text-orange-400">Турниры</h2>
          <p className="mt-2 text-sm text-slate-300">
            Календарь турниров, составы участников и все сыгранные матчи
            с картами и счётом.
          </p>
        </div>
        <div className="card">
          <h2 className="text-lg font-bold text-orange-400">Демки → статистика</h2>
          <p className="mt-2 text-sm text-slate-300">
            Загружайте .dem с Fastcup: парсер извлекает киллы, ассисты, ADR,
            хедшоты и счёт матча.
          </p>
        </div>
        <div className="card">
          <h2 className="text-lg font-bold text-orange-400">Средние показатели</h2>
          <p className="mt-2 text-sm text-slate-300">
            Для каждого игрока считаются средние значения за все игры:
            K/D, ADR, HS% и рейтинг.
          </p>
        </div>
      </div>
    </section>
  );
}
