import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query";

export function HealthBadge() {
  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => api.health(signal),
  });
  const status = isPending ? "checking" : isError || !data.ok ? "down" : "ok";
  const variant = status === "ok" ? "default" : status === "down" ? "destructive" : "secondary";
  return <Badge variant={variant}>API: {status}</Badge>;
}
