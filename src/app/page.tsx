import Link from "next/link";
import {
  Brain,
  Sparkles,
  Download,
  BarChart2,
  ChevronRight,
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI Deck Analysis",
    description:
      "Get structured analysis of your deck's strengths and weaknesses. Understand your win conditions, curve, and consistency at a glance.",
  },
  {
    icon: Sparkles,
    title: "Smart Recommendations",
    description:
      "AI-powered swap suggestions that respect your Commander bracket, play style, and budget constraints.",
  },
  {
    icon: Download,
    title: "Deck Import",
    description:
      "Import instantly from MTGO or Arena format text lists. Paste your decklist and start analyzing in seconds.",
  },
  {
    icon: BarChart2,
    title: "Match Tracking",
    description:
      "Log games, track card performance over time, and discover which cards are actually pulling their weight.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <header className="border-b border-zinc-800/60 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-lg font-semibold tracking-tight text-zinc-100">
            DeckPilot
          </span>
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-md px-4 py-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-100"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-white"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 pb-24 pt-28 text-center">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
            <Sparkles size={11} className="text-amber-400" />
            AI-powered Commander tools
          </div>
          <h1 className="mb-5 max-w-2xl text-5xl font-bold tracking-tight text-zinc-50 sm:text-6xl">
            Build smarter
            <br />
            <span className="text-zinc-400">Commander decks</span>
          </h1>
          <p className="mb-10 max-w-lg text-lg leading-relaxed text-zinc-400">
            Build, analyze, and optimize your Magic: The Gathering Commander
            decks with AI-powered recommendations tailored to your bracket and
            budget.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-6 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white"
            >
              Get Started
              <ChevronRight size={15} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
            >
              Sign In
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-zinc-800/60 bg-zinc-900/40 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-12 text-center text-sm font-semibold uppercase tracking-widest text-zinc-500">
              Everything you need
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition-colors hover:border-zinc-700"
                >
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800">
                    <Icon size={18} className="text-zinc-300" />
                  </div>
                  <h3 className="mb-2 text-sm font-semibold text-zinc-100">
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed text-zinc-500">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 px-6 py-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-1 text-center sm:flex-row sm:justify-between">
          <span className="text-sm text-zinc-600">
            &copy; {new Date().getFullYear()} DeckPilot
          </span>
          <span className="text-xs text-zinc-700">
            Powered by{" "}
            <a
              href="https://scryfall.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-zinc-500"
            >
              Scryfall
            </a>{" "}
            data
          </span>
        </div>
      </footer>
    </div>
  );
}
