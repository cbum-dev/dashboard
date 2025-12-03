import Link from "next/link";
import {
  ArrowRight,
  History,
  Users2,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: <Users2 className="h-5 w-5" />,
    title: "Workspaces & roles",
    description:
      "Organize teams, set granular access, and invite collaborators in seconds.",
  },
  {
    icon: <History className="h-5 w-5" />,
    title: "Version history",
    description:
      "Automatic snapshots with side-by-side diffs keep every change accountable.",
  },
  {
    icon: <Sparkles className="h-5 w-5" />,
    title: "Realtime editing",
    description:
      "Yjs-powered collaboration with presence, cursors, and conflict-free merging.",
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: "Secure by default",
    description:
      "JWT auth, workspace isolation, and audit trails protect your IP.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            CS
          </span>
          CollabSpace
        </div>
        <div className="hidden gap-3 text-sm text-muted-foreground sm:flex">
          <Link href="/login" className="hover:text-foreground">
            Sign in
          </Link>
          <Link href="/register" className="hover:text-foreground">
            Create account
          </Link>
        </div>
        <Button asChild className="sm:hidden" variant="outline">
          <Link href="/login">Launch app</Link>
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-6 pb-16">
        <section className="grid gap-8 rounded-3xl border border-border bg-card/70 p-8 shadow-sm lg:grid-cols-2">
          <div className="space-y-6">
            <Badge className="bg-primary/10 text-primary" variant="secondary">
              Built for product, design, and research teams
            </Badge>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                Where your team thinks, drafts, and ships together.
              </h1>
              <p className="text-base text-muted-foreground">
                CollabSpace unifies realtime editing, knowledge management, and
                version history so cross-functional teams can move from idea to
                sign-off in one beautiful canvas.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/register">
                  Get started <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/login">Open dashboard</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-2xl font-semibold">2k+</p>
                <p className="text-muted-foreground">Teams collaborating</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">98.9%</p>
                <p className="text-muted-foreground">Uptime this quarter</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">120ms</p>
                <p className="text-muted-foreground">Average sync latency</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative w-full max-w-md rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-background to-secondary/20 p-6 shadow-lg">
              <p className="text-sm font-medium text-muted-foreground">
                Live activity
              </p>
              <ul className="mt-6 space-y-4 text-sm">
                <li className="flex items-center justify-between rounded-2xl border border-border/80 bg-background/60 px-4 py-3">
                  <span className="font-medium">Roadmap sync</span>
                  <span className="text-muted-foreground">12 collaborators</span>
                </li>
                <li className="flex items-center justify-between rounded-2xl border border-border/80 bg-background/60 px-4 py-3">
                  <span className="font-medium">Marketing brief</span>
                  <span className="text-muted-foreground">6 updates</span>
                </li>
                <li className="flex items-center justify-between rounded-2xl border border-border/80 bg-background/60 px-4 py-3">
                  <span className="font-medium">UX research hub</span>
                  <span className="text-muted-foreground">18 snapshots</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => (
            <Card key={feature.title} className="h-full">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {feature.icon}
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    {feature.title}
                  </CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          ))}
        </section>
      </main>
      <footer className="border-t border-border/80 bg-background/60 py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} CollabSpace. Built for high-trust collaboration.
      </footer>
    </div>
  );
}
