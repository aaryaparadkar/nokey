import type { PublicUser } from "@nokey/shared";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { Fingerprint, Icon } from "@/components/sodium/icon";
import { Button } from "@/components/sodium/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/sodium/ui/field";
import {
  Frame,
  FrameBody,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FrameTitle,
} from "@/components/sodium/ui/frame";
import { Input } from "@/components/sodium/ui/input";
import { toast } from "@/components/sodium/ui/toast";
import { UnsupportedNotice } from "@/components/unsupported-notice";
import { useSession, useSetSessionUser } from "@/hooks/use-session";
import {
  armPasskeyAutofill,
  cancelPasskeyCeremony,
  type PasskeyError,
  signInWithPasskey,
  supportsPasskeys,
} from "@/lib/passkey";

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

  const onSignedIn = (u: PublicUser) => {
    setSessionUser(u);
    toast.success(u.handle ? `Welcome back, ${u.handle}` : "Signed in");
    navigate(next, { replace: true });
  };

  const signIn = useMutation<PublicUser, PasskeyError>({
    mutationFn: signInWithPasskey,
    onSuccess: onSignedIn,
  });

  // Conditional UI: offer passkeys in the field's autofill dropdown.
  const [autofillError, setAutofillError] = useState<PasskeyError | null>(null);
  const [autofillPending, setAutofillPending] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: arm once per mount
  useEffect(() => {
    if (!supported || user) return;
    let live = true;
    armPasskeyAutofill()
      .then((u) => {
        if (live && u) onSignedIn(u);
      })
      .catch((e: PasskeyError) => live && setAutofillError(e))
      .finally(() => live && setAutofillPending(false));
    setAutofillPending(true);
    return () => {
      live = false;
      cancelPasskeyCeremony();
    };
  }, [supported]);

  if (user && !signIn.isPending && !signIn.isSuccess) return <Navigate to={next} replace />;

  const err = signIn.error ?? autofillError;
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
          {supported && (
            <Field>
              <FieldLabel optional>Account</FieldLabel>
              {/* "webauthn" in autocomplete is what lets the browser list passkeys here. */}
              <Input
                name="username"
                autoComplete="username webauthn"
                placeholder="Choose a passkey"
                aria-busy={autofillPending || undefined}
              />
              <FieldDescription>
                Focus the field to pick a saved passkey, or use the button.
              </FieldDescription>
            </Field>
          )}
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
