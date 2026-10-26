import { createFileRoute } from "@tanstack/react-router";
import { QuizDetail } from "@/components/browse";

export const Route = createFileRoute("/_app/explore/$quizId")({
  component: function Detail() {
    const { quizId } = Route.useParams();
    return <QuizDetail quizId={quizId} />;
  },
});
