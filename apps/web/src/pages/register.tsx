import { Handle } from "@nokey/shared";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Fingerprint, Icon } from "@/components/sodium/icon";
import { Button } from "@/components/sodium/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/sodium/ui/field";
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
import { useSetSessionUser } from "@/hooks/use-session";
import { type PasskeyError, registerPasskey, supportsPasskeys } from "@/lib/passkey";

export function RegisterPage() {
  const navigate = useNavigate();
  const [handle, setHandle] = useState("");
  const [supported] = useState(supportsPasskeys);
  const setSessionUser = useSetSessionUser();

  const trimmed = handle.trim();
  const handleError = trimmed ? Handle.safeParse(trimmed).error?.issues[0]?.message : undefined;

  const register = useMutation<Awaited<ReturnType<typeof registerPasskey>>, PasskeyError>({
    mutationFn: () => registerPasskey(trimmed || undefined),
    onSuccess: (user) => {
      setSessionUser(user);
      toast.success(user.handle ? `Welcome, ${user.handle}` : "Passkey created");
      navigate("/");
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!handleError) register.mutate();
  };

  return (
    <div className="mx-auto max-w-96 space-y-4 py-8">
      <h1 className="type-title">Create your account</h1>
      <form onSubmit={onSubmit}>
        <Frame aria-label="Create a passkey">
          <FrameHeader>
            <FrameTitle>Passkey</FrameTitle>
          </FrameHeader>
          <FrameBody className="space-y-4">
            <FrameDescription>
              No email, no password. Your device stores a passkey and unlocks it with your
              fingerprint, face or PIN.
            </FrameDescription>
            {!supported && <UnsupportedNotice />}
            <Field invalid={!!handleError} disabled={register.isPending}>
              <FieldLabel optional>Display name</FieldLabel>
              <Input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="alice"
                maxLength={32}
                autoComplete="off"
              />
              {handleError ? (
                <FieldError match>{handleError}</FieldError>
              ) : (
                <FieldDescription>
                  Shown in your passkey manager so you can tell accounts apart.
                </FieldDescription>
              )}
            </Field>
            {register.error && register.error.kind !== "cancelled" && (
              <p role="alert" className="type-body-sm text-fail-text">
                {register.error.message}
              </p>
            )}
            {register.error?.kind === "cancelled" && (
              <p className="type-body-sm text-text-2">{register.error.message}</p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={!supported || !!handleError}
              pending={register.isPending}
              pendingLabel="Waiting for your passkey"
            >
              <Icon icon={Fingerprint} /> Create passkey
            </Button>
          </FrameBody>
          <FrameFooter>
            <p className="type-body-sm text-text-2">
              Already have one?{" "}
              <Link to="/login" className="text-text-1 underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </FrameFooter>
        </Frame>
      </form>
    </div>
  );
}
