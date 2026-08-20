import { createFileRoute } from "@tanstack/react-router";
import { WrestlingApp } from "@/components/wrestling/WrestlingApp";

export const Route = createFileRoute("/wrestling")({ component: WrestlingPage });

function WrestlingPage() {
  return <WrestlingApp />;
}
