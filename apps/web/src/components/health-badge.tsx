import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

type Status = "checking" | "ok" | "down";

export function HealthBadge() {
  const [status, setStatus] = useState<Status>("checking");
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/health", { signal: ctrl.signal })
      .then((r) => r.json() as Promise<{ ok?: boolean }>)
      .then((d) => setStatus(d.ok ? "ok" : "down"))
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) setStatus("down");
      });
    return () => ctrl.abort();
  }, []);
  const variant = status === "ok" ? "default" : status === "down" ? "destructive" : "secondary";
  return <Badge variant={variant}>API: {status}</Badge>;
}
