import { toast } from "sonner";
import { HealthBadge } from "@/components/health-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function HomePage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New paste</h1>
        <HealthBadge />
      </div>
      <Textarea placeholder="Paste something…" className="min-h-64 font-mono" />
      <Button onClick={() => toast("Paste creation arrives in Phase 16")}>Create paste</Button>
    </div>
  );
}
