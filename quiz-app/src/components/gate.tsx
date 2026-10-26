import type { ReactNode } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { PageSkeleton } from "@/components/kit";

export function RequireUser({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <PageSkeleton />;
  if (!user) return <RedirectToSignIn />;
  return children;
}
