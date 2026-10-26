import { createFileRoute } from "@tanstack/react-router";
import { LeaderboardPage } from "@/components/account";

export const Route = createFileRoute("/_app/leaderboard")({ component: LeaderboardPage });
