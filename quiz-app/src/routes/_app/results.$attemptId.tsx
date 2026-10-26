import { createFileRoute } from "@tanstack/react-router";
import { Results } from "@/components/results";

export const Route = createFileRoute("/_app/results/$attemptId")({
  component: function ResultRoute() {
    const { attemptId } = Route.useParams();
    return <Results attemptId={attemptId} />;
  },
});
