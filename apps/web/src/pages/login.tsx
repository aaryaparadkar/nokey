import type { PublicUser } from "@nokey/shared";
import { useMutation } from "@tanstack/react-query";
import { FingerprintIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UnsupportedNotice } from "@/components/unsupported-notice";
import { useSession, useSetSessionUser } from "@/hooks/use-session";
import { type PasskeyError, signInWithPasskey, supportsPasskeys } from "@/lib/passkey";

/** Only follow same-app paths, never absolute URLs (open-redirect guard). */
const safeNext = (v: unknown) =>
  typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const next = safeNext(new URLSearchParams(location.search).get("next"));
  const { user } = useSession();
  const setSessionUser = useSetSessionUser();
  const [supported] = useState(supportsPasskeys);

  const signIn = useMutation<PublicUser, PasskeyError>({
    mutationFn: signInWithPasskey,
    onSuccess: (u) => {
      setSessionUser(u);
      toast.success(u.handle ? `Welcome back, ${u.handle}` : "Signed in");
      navigate(next, { replace: true });
    },
  });

  if (user && !signIn.isPending && !signIn.isSuccess) return <Navigate to={next} replace />;

  const err = signIn.error;
  return (
    <div className="mx-auto max-w-sm py-8">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Use the passkey you created on this device, your phone or your password manager.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!supported && <UnsupportedNotice />}
          {err && (
            <p
              role={err.kind === "cancelled" ? undefined : "alert"}
              className={
                err.kind === "cancelled"
                  ? "text-sm text-muted-foreground"
                  : "text-sm text-destructive"
              }
            >
              {err.message}
              {err.kind === "not_recognized" && (
                <>
                  {" "}
                  If you deleted this account, you can{" "}
                  <Link to="/register" className="underline underline-offset-4">
                    create a new one
                  </Link>
                  .
                </>
              )}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-3">
          <Button
            className="w-full"
            onClick={() => signIn.mutate()}
            disabled={!supported || signIn.isPending}
          >
            {signIn.isPending ? <Loader2Icon className="animate-spin" /> : <FingerprintIcon />}
            {signIn.isPending ? "Waiting for your passkey…" : "Sign in with passkey"}
          </Button>
          <p className="text-sm text-muted-foreground">
            New here?{" "}
            <Link to="/register" className="text-foreground underline underline-offset-4">
              Create an account
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
