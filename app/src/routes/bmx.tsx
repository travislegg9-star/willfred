import { createFileRoute } from "@tanstack/react-router";
import { BmxApp } from "@/components/bmx/BmxApp";

export const Route = createFileRoute("/bmx")({ component: BmxPage });

function BmxPage() {
  return <BmxApp />;
}
