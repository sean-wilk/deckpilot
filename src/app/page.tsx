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
    <div className="dark flex min-h-screen flex-col bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border/60 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-lg font-semibold tracking-tight text-foreground">
            DeckPilot
          </span>
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-md px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
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
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles size={11} className="text-amber-400" />
            AI-powered Commander tools
          </div>
          <h1 className="text-display mb-5 max-w-2xl text-5xl font-bold tracking-tight sm:text-6xl">
            Build smarter
            <br />
            <span className="text-muted-foreground">Commander decks</span>
          </h1>
          <p className="mb-10 max-w-lg text-lg leading-relaxed text-muted-foreground">
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-6 py-3 text-sm font-semibold text-foreground/80 transition-colors hover:border-border/70 hover:text-foreground"
            >
              Sign In
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border/60 bg-card/40 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-12 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground/70">
              Everything you need
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-border/70"
                >
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Icon size={18} className="text-foreground/80" />
                  </div>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 px-6 py-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-1 text-center sm:flex-row sm:justify-between">
          <span className="text-sm text-muted-foreground/70">
            &copy; {new Date().getFullYear()} DeckPilot
          </span>
          <span className="text-xs text-muted-foreground/70">
            Powered by{" "}
            <a
              href="https://scryfall.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-muted-foreground"
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
