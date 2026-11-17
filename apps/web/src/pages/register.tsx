import { Handle } from "@nokey/shared";
import { useMutation } from "@tanstack/react-query";
import { FingerprintIcon, Loader2Icon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
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
import { Input } from "@/components/ui/input";
import { UnsupportedNotice } from "@/components/unsupported-notice";
import { type PasskeyError, registerPasskey, supportsPasskeys } from "@/lib/passkey";

export function RegisterPage() {
  const navigate = useNavigate();
  const [handle, setHandle] = useState("");
  const [supported] = useState(supportsPasskeys);

  const trimmed = handle.trim();
  const handleError = trimmed ? Handle.safeParse(trimmed).error?.issues[0]?.message : undefined;

  const register = useMutation<Awaited<ReturnType<typeof registerPasskey>>, PasskeyError>({
    mutationFn: () => registerPasskey(trimmed || undefined),
    onSuccess: (user) => {
      toast.success(user.handle ? `Welcome, ${user.handle}!` : "Passkey created!");
      navigate("/");
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!handleError) register.mutate();
  };

  return (
    <div className="mx-auto max-w-sm py-8">
      <Card>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            No email, no password. Your device stores a passkey and unlocks it with your
            fingerprint, face or PIN.
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            {!supported && <UnsupportedNotice />}
            <div className="space-y-2">
              <label htmlFor="handle" className="text-sm font-medium">
                Display name <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="e.g. alice"
                maxLength={32}
                autoComplete="off"
                aria-invalid={!!handleError}
                disabled={register.isPending}
              />
              <p className="text-xs text-muted-foreground">
                {handleError ?? "Shown in your passkey manager so you can tell accounts apart."}
              </p>
            </div>
            {register.error && register.error.kind !== "cancelled" && (
              <p role="alert" className="text-sm text-destructive">
                {register.error.message}
              </p>
            )}
            {register.error?.kind === "cancelled" && (
              <p className="text-sm text-muted-foreground">{register.error.message}</p>
            )}
          </CardContent>
          <CardFooter className="mt-6 flex-col gap-3">
            <Button
              type="submit"
              className="w-full"
              disabled={!supported || !!handleError || register.isPending}
            >
              {register.isPending ? <Loader2Icon className="animate-spin" /> : <FingerprintIcon />}
              {register.isPending ? "Waiting for your passkey…" : "Create passkey"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have one?{" "}
              <Link to="/login" className="text-foreground underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
