import { HealthBadge } from "@/components/health-badge";
import { Button } from "@/components/sodium/ui/button";
import { Field, FieldLabel } from "@/components/sodium/ui/field";
import { Textarea } from "@/components/sodium/ui/textarea";
import { toast } from "@/components/sodium/ui/toast";

export function HomePage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="type-title">New paste</h1>
        <HealthBadge />
      </div>
      <Field>
        <FieldLabel>Paste content</FieldLabel>
        <Textarea placeholder="Paste something" rows={12} />
      </Field>
      <Button onClick={() => toast("Paste creation arrives in Phase 16")}>Create paste</Button>
    </div>
  );
}
