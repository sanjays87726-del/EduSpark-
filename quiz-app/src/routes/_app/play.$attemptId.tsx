import { createFileRoute } from "@tanstack/react-router";
import { Player } from "@/components/player";

export const Route = createFileRoute("/_app/play/$attemptId")({
  component: function PlayRoute() {
    const { attemptId } = Route.useParams();
    return <Player attemptId={attemptId} />;
  },
});
