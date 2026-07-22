import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "sousChef — Your personal cooking companion",
  description:
    "Manage your recipes, plan your meals, track your pantry, and get intelligent help in the kitchen. Built for home cooks who take food seriously.",
  openGraph: {
    title: "sousChef — Your personal cooking companion",
    description:
      "Manage your recipes, plan your meals, track your pantry, and get intelligent help in the kitchen.",
    type: "website",
  },
};

// ─── SVG illustrations ─────────────────────────────────────────────────────

function ChefHatIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="32" cy="32" r="32" fill="#fff7ed" />
      <path
        d="M20 36c0-6.627 5.373-12 12-12s12 5.373 12 12"
        stroke="#f97316"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <rect x="18" y="36" width="28" height="10" rx="3" fill="#fed7aa" stroke="#f97316" strokeWidth="2" />
      <line x1="24" y1="36" x2="24" y2="46" stroke="#f97316" strokeWidth="1.5" />
      <line x1="32" y1="36" x2="32" y2="46" stroke="#f97316" strokeWidth="1.5" />
      <line x1="40" y1="36" x2="40" y2="46" stroke="#f97316" strokeWidth="1.5" />
      <circle cx="24" cy="26" r="4" fill="#fed7aa" stroke="#f97316" strokeWidth="2" />
      <circle cx="40" cy="26" r="4" fill="#fed7aa" stroke="#f97316" strokeWidth="2" />
      <circle cx="32" cy="24" r="5" fill="#fed7aa" stroke="#f97316" strokeWidth="2" />
    </svg>
  );
}

function TimerIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="32" cy="32" r="32" fill="#fff7ed" />
      <circle cx="32" cy="35" r="14" stroke="#f97316" strokeWidth="2.5" />
      <path d="M32 28v8l5 3" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 18h8" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 18v4" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function ForkIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="32" cy="32" r="32" fill="#fff7ed" />
      {/* left tine */}
      <line x1="24" y1="14" x2="24" y2="28" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
      {/* right tine */}
      <line x1="32" y1="14" x2="32" y2="28" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
      {/* curve at top of tines */}
      <path d="M24 28 Q24 34 28 34 Q32 34 32 28" stroke="#f97316" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* stem */}
      <line x1="28" y1="34" x2="28" y2="50" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
      {/* fork-into-collection arrow */}
      <path d="M38 20 Q44 20 44 26 L44 38 Q44 44 38 44" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 2" />
      <polyline points="36,41 38,44 36,47" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function PantryIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="32" cy="32" r="32" fill="#fff7ed" />
      {/* jar */}
      <rect x="22" y="26" width="20" height="22" rx="3" fill="#fed7aa" stroke="#f97316" strokeWidth="2" />
      {/* jar lid */}
      <rect x="20" y="21" width="24" height="7" rx="2" fill="#f97316" />
      {/* fill level */}
      <rect x="22" y="38" width="20" height="10" rx="0 0 3 3" fill="#fb923c" opacity="0.5" />
      {/* label line */}
      <line x1="26" y1="33" x2="38" y2="33" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="26" y1="36" x2="34" y2="36" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SparkleIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="32" cy="32" r="32" fill="#fff7ed" />
      <path
        d="M32 16 L34.5 29.5 L48 32 L34.5 34.5 L32 48 L29.5 34.5 L16 32 L29.5 29.5 Z"
        fill="#fed7aa"
        stroke="#f97316"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M46 16 L47 20 L51 21 L47 22 L46 26 L45 22 L41 21 L45 20 Z"
        fill="#fb923c" stroke="#f97316" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Feature card ──────────────────────────────────────────────────────────

type FeatureProps = {
  icon: React.ReactNode;
  title: string;
  body: string;
};

function Feature({ icon, title, body }: FeatureProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl border border-orange-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="h-12 w-12 shrink-0">{icon}</div>
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{body}</p>
      </div>
    </div>
  );
}

// ─── Community / fork section ──────────────────────────────────────────────

function CommunitySection(): React.JSX.Element {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <div className="grid gap-12 md:grid-cols-2 md:items-center">
        {/* Illustration */}
        <div className="flex justify-center">
          <div className="relative flex flex-col items-center gap-4">
            {/* Community recipe card mockup */}
            <div className="w-72 rounded-2xl border border-gray-100 bg-white p-4 shadow-md dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 h-32 w-full rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-950 dark:to-orange-900 flex items-center justify-center text-4xl">
                🥖
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Sourdough Country Loaf</p>
              <p className="mt-1 text-xs text-gray-400">by breadhead_paul · 847 saves</p>
              <div className="mt-3 flex gap-2">
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600 dark:bg-orange-950 dark:text-orange-400">Baking</span>
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600 dark:bg-orange-950 dark:text-orange-400">Fermentation</span>
              </div>
            </div>

            {/* Fork arrow */}
            <div className="flex h-14 w-14 items-center justify-center">
              <ForkIcon />
            </div>

            {/* Saved to collection mockup */}
            <div className="w-72 rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm dark:border-orange-900 dark:bg-orange-950">
              <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">Saved to your collection</p>
              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">My Bread Recipes</p>
              <p className="mt-0.5 text-xs text-gray-400">12 recipes · last updated today</p>
            </div>
          </div>
        </div>

        {/* Copy */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">Community</p>
          <h2 className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
            Discover recipes.<br />Make them yours.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-gray-500 dark:text-gray-400">
            Browse thousands of recipes shared by home cooks. Search by ingredient, cuisine, or dietary need — then fork any recipe into your own collection with one click. Adapt it, scale it, make it your own.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "Search the community by ingredient or cuisine",
              "Fork any public recipe into your collection",
              "Scale servings and swap ingredients with AI help",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-300">
                <span className="mt-0.5 shrink-0 text-orange-500">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function LandingPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold text-orange-500 tracking-tight">sousChef</span>
          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
            >
              Sign in
            </Link>
            <Link href="/sign-up" className="btn-primary text-sm">
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600 dark:bg-orange-950 dark:text-orange-400 mb-6">
          <span>🧑‍🍳</span> Built for home cooks who take food seriously
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100 leading-tight md:text-6xl">
          Your kitchen,<br />
          <span className="text-orange-500">organised.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-gray-500 dark:text-gray-400 leading-relaxed">
          One place to manage your recipes, plan your meals, track what&apos;s in your pantry, and get intelligent help when you need it.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/sign-up" className="btn-primary px-6 py-3 text-base">
            Start cooking →
          </Link>
          <Link
            href="/community"
            className="rounded-lg px-6 py-3 text-base font-semibold text-gray-600 hover:text-orange-500 transition-colors dark:text-gray-400 dark:hover:text-orange-400"
          >
            Browse community recipes
          </Link>
        </div>

        {/* Hero image — app mockup placeholder */}
        <div className="mt-14 overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-b from-orange-50 to-orange-100 shadow-xl dark:border-gray-800 dark:from-gray-900 dark:to-gray-800">
          <div className="px-8 pt-8 pb-0">
            {/* Fake browser chrome */}
            <div className="flex items-center gap-1.5 mb-4">
              <span className="h-3 w-3 rounded-full bg-red-300 dark:bg-red-900" />
              <span className="h-3 w-3 rounded-full bg-yellow-300 dark:bg-yellow-900" />
              <span className="h-3 w-3 rounded-full bg-green-300 dark:bg-green-900" />
              <span className="ml-4 flex-1 rounded bg-white/60 dark:bg-gray-700/60 px-3 py-1 text-xs text-gray-400">souschef.app/recipes</span>
            </div>
            {/* Mock recipe grid */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { emoji: "🍝", title: "Cacio e Pepe", time: "25 min", tag: "Italian" },
                { emoji: "🍞", title: "Sourdough", time: "12 hr", tag: "Baking" },
                { emoji: "🥘", title: "Lamb Tagine", time: "2 hr", tag: "Moroccan" },
                { emoji: "🧁", title: "Lemon Tart", time: "90 min", tag: "Patisserie" },
                { emoji: "🍜", title: "Ramen Broth", time: "4 hr", tag: "Japanese" },
                { emoji: "🫙", title: "Kimchi", time: "3 days", tag: "Fermented" },
              ].map((r) => (
                <div key={r.title} className="rounded-xl bg-white dark:bg-gray-800 p-3 text-left shadow-sm">
                  <div className="mb-2 flex h-16 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-950 text-3xl">
                    {r.emoji}
                  </div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{r.title}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{r.time} · {r.tag}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="bg-gray-50 dark:bg-gray-900 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-500 mb-2">Features</p>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Everything you need in the kitchen</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Feature
              icon={<ChefHatIcon />}
              title="Guided cooking mode"
              body="Fullscreen step-by-step mode with per-step timers and screen wake lock so your phone doesn't sleep mid-recipe."
            />
            <Feature
              icon={<TimerIcon />}
              title="Meal planning"
              body="Drag recipes onto a weekly planner and get a shopping list generated automatically, deducted against your pantry."
            />
            <Feature
              icon={<PantryIcon />}
              title="Pantry tracker"
              body="Know what you have. Track stock levels and expiry dates, and get alerted when things are running low."
            />
            <Feature
              icon={<SparkleIcon />}
              title="AI ingredient swaps"
              body="Need a substitute? Ask sousChef for alternatives to any ingredient, with notes on how it'll change the dish."
            />
            <Feature
              icon={<ForkIcon />}
              title="Recipe import"
              body="Paste any URL and sousChef pulls the recipe in automatically — no more bookmarking tabs you'll never open again."
            />
            <Feature
              icon={<ChefHatIcon />}
              title="Fermentation tracker"
              body="Log batches, track timelines, upload photos, and get AI troubleshooting when your kimchi isn't quite right."
            />
          </div>
        </div>
      </section>

      {/* Community / fork section */}
      <CommunitySection />

      {/* Cooking mode callout */}
      <section className="bg-orange-500 dark:bg-orange-600 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-orange-100 mb-2">Cooking mode</p>
              <h2 className="text-3xl font-bold text-white leading-tight">
                Hands-free cooking, step by step
              </h2>
              <p className="mt-4 text-base text-orange-100 leading-relaxed">
                Switch to cooking mode and follow each step in full screen. Timers fire when they should, your screen stays on, and you can scale the recipe right up to the minute you start cooking.
              </p>
            </div>
            {/* Mock cooking mode card */}
            <div className="rounded-2xl bg-white/10 backdrop-blur p-6 border border-white/20">
              <p className="text-xs font-semibold uppercase tracking-widest text-orange-200 mb-1">Step 3 of 8</p>
              <p className="text-xl font-bold text-white mb-3">Add the pasta to the pan</p>
              <p className="text-sm text-orange-100 leading-relaxed mb-5">
                Cook the spaghetti in well-salted boiling water for 1 minute less than the packet instructions — you&apos;ll finish it in the sauce.
              </p>
              <div className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3">
                <span className="text-sm text-orange-100">Timer</span>
                <span className="text-2xl font-bold text-white tabular-nums">8:00</span>
                <button className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-orange-600">
                  Start
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <h2 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
          Ready to cook smarter?
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base text-gray-500 dark:text-gray-400">
          Free to get started. No credit card required.
        </p>
        <Link href="/sign-up" className="btn-primary mt-8 inline-block px-8 py-3 text-base">
          Create your free account
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 dark:border-gray-800 py-10">
        <div className="mx-auto max-w-5xl px-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <span className="text-sm font-bold text-orange-500">sousChef</span>
          <div className="flex gap-6 text-sm text-gray-400">
            <Link href="/privacy" className="hover:text-gray-600 dark:hover:text-gray-200 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-600 dark:hover:text-gray-200 transition-colors">Terms</Link>
            <Link href="/community" className="hover:text-gray-600 dark:hover:text-gray-200 transition-colors">Community</Link>
            <Link href="/sign-in" className="hover:text-gray-600 dark:hover:text-gray-200 transition-colors">Sign in</Link>
          </div>
          <p className="text-xs text-gray-300 dark:text-gray-600">© {new Date().getFullYear()} sousChef</p>
        </div>
      </footer>
    </div>
  );
}
