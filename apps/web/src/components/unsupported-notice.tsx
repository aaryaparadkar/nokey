import { TriangleAlertIcon } from "lucide-react";

export function UnsupportedNotice() {
  return (
    <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="space-y-1">
        <p className="font-medium">Passkeys aren't available here</p>
        <p className="text-muted-foreground">
          Use a recent version of Chrome, Safari, Edge or Firefox. Passkeys also need HTTPS (or
          localhost).
        </p>
      </div>
    </div>
  );
}
