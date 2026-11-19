import { Link } from "react-router";
import { Button } from "@/components/sodium/ui/button";
import {
  DataList,
  DataListItem,
  DataListLabel,
  DataListValue,
} from "@/components/sodium/ui/data-list";

const parts = [
  ["Sign in", "WebAuthn passkeys, no passwords"],
  ["Sessions", "HTTP-only cookies and CSRF checks"],
  ["Server", "Bun, Hono and SQLite through Drizzle"],
  ["Client", "React, TanStack Query and Sodium"],
] as const;

export function LandingPage() {
  return (
    <div className="mx-auto max-w-160 space-y-12 py-12 sm:py-20">
      <div className="space-y-6">
        <h1 className="type-display text-balance">A pastebin. Nothing new.</h1>
        <p className="type-body max-w-measure text-text-2">
          nokey is a pastebin you sign in to with a passkey. Pastebins exist, passkeys exist, and
          none of this does either better. It was built to learn how the pieces fit together, and
          it's here so you can look around.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" render={<Link to="/new" />} nativeButton={false}>
            Try it out
          </Button>
          <Button
            size="lg"
            variant="secondary"
            render={<a href="https://github.com" />}
            nativeButton={false}
          >
            Read the source
          </Button>
        </div>
      </div>
      <section className="frame" aria-labelledby="parts-title">
        <header className="panel-head">
          <h2 id="parts-title" className="type-label">
            What it's made of
          </h2>
        </header>
        <div className="px-4">
          <DataList>
            {parts.map(([label, value]) => (
              <DataListItem key={label}>
                <DataListLabel>{label}</DataListLabel>
                <DataListValue prose>{value}</DataListValue>
              </DataListItem>
            ))}
          </DataList>
        </div>
      </section>
      <p className="type-caption text-text-3">
        A learning project. Don't keep anything here you'd miss.
      </p>
    </div>
  );
}
