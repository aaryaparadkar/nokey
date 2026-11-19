import { Link, useNavigate } from "react-router";
import { Icon, Key, Logout, User } from "@/components/sodium/icon";
import { Button } from "@/components/sodium/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/sodium/ui/dropdown-menu";
import { toast } from "@/components/sodium/ui/toast";
import { useLogout, useSession } from "@/hooks/use-session";

export function UserMenu() {
  const { user, isLoading } = useSession();
  const logout = useLogout();
  const navigate = useNavigate();

  if (isLoading) return <div className="h-8 w-20" aria-hidden />;

  if (!user) {
    return (
      <Button size="sm" render={<Link to="/login" />} nativeButton={false}>
        Sign in
      </Button>
    );
  }

  const name = user.handle ?? "Anonymous";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="secondary" size="sm" />}>
        <Icon icon={User} /> <span className="max-w-32 truncate">{name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLinkItem render={<Link to="/account" />}>
          <Icon icon={Key} /> Manage passkeys
        </DropdownMenuLinkItem>
        <DropdownMenuItem
          onClick={() =>
            logout.mutate(undefined, {
              onSuccess: () => {
                toast("Signed out");
                navigate("/");
              },
              onError: () => toast.fail("Sign out failed", { description: "Try again." }),
            })
          }
        >
          <Icon icon={Logout} /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
