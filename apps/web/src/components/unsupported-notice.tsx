import { Alert, AlertDescription, AlertTitle } from "@/components/sodium/ui/alert";

export function UnsupportedNotice() {
  return (
    <Alert status="warn">
      <AlertTitle>Passkeys on this browser</AlertTitle>
      <AlertDescription>
        This browser can't use passkeys; use a recent Chrome, Safari, Edge or Firefox over HTTPS or
        localhost.
      </AlertDescription>
    </Alert>
  );
}
