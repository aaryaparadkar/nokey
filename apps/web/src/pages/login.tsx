import type { PublicUser } from "@nokey/shared";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { Fingerprint, Icon } from "@/components/sodium/icon";
import { Button } from "@/components/sodium/ui/button";
import {
  Frame,
  FrameBody,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FrameTitle,
} from "@/components/sodium/ui/frame";
import { toast } from "@/components/sodium/ui/toast";
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
    <div className="mx-auto max-w-96 space-y-4 py-8">
      <h1 className="type-title">Sign in</h1>
      <Frame aria-label="Sign in with a passkey">
        <FrameHeader>
          <FrameTitle>Passkey</FrameTitle>
        </FrameHeader>
        <FrameBody className="space-y-4">
          <FrameDescription>
            Use the passkey you created on this device, your phone or your password manager.
          </FrameDescription>
          {!supported && <UnsupportedNotice />}
          {err && (
            <p
              role={err.kind === "cancelled" ? undefined : "alert"}
              className={
                err.kind === "cancelled"
                  ? "type-body-sm text-text-2"
                  : "type-body-sm text-fail-text"
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
          <Button
            className="w-full"
            onClick={() => signIn.mutate()}
            disabled={!supported}
            pending={signIn.isPending}
            pendingLabel="Waiting for your passkey"
          >
            <Icon icon={Fingerprint} /> Sign in with passkey
          </Button>
        </FrameBody>
        <FrameFooter>
          <p className="type-body-sm text-text-2">
            New here?{" "}
            <Link to="/register" className="text-text-1 underline underline-offset-4">
              Create an account
            </Link>
          </p>
        </FrameFooter>
      </Frame>
    </div>
  );
}
