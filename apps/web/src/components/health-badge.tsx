import { useQuery } from "@tanstack/react-query";
import { Tag } from "@/components/sodium/ui/tag";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query";

export function HealthBadge() {
  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => api.health(signal),
  });
  if (isPending) return <Tag variant="outline">API checking</Tag>;
  if (isError || !data.ok) return <Tag variant="fail">API down</Tag>;
  return <Tag variant="ok">API ok</Tag>;
}
