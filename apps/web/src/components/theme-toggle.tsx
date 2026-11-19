import { Icon, Monitor, Moon, Sun } from "@/components/sodium/icon";
import { Button } from "@/components/sodium/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/sodium/ui/dropdown-menu";
import { type Theme, useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Change theme" />}
      >
        <Icon icon={resolvedTheme === "dark" ? Moon : Sun} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
          <DropdownMenuRadioItem value="light">
            <Icon icon={Sun} /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Icon icon={Moon} /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Icon icon={Monitor} /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
