import type { PublicUser } from "@nokey/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query";

export function useSession() {
  const query = useQuery({
    queryKey: queryKeys.session,
    queryFn: ({ signal }) => api.me(signal),
    staleTime: 5 * 60_000,
  });
  return { ...query, user: query.data ?? null, isLoading: query.isPending };
}

/** Put a freshly signed-in user into the cache without refetching. */
export function useSetSessionUser() {
  const qc = useQueryClient();
  return (user: PublicUser | null) => qc.setQueryData(queryKeys.session, user);
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    onSettled: () => {
      qc.setQueryData(queryKeys.session, null);
      // Anything cached may have been user-specific.
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== queryKeys.session[0] });
    },
  });
}
