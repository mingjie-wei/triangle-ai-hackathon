import Explorer from "@/components/Explorer";
import { FIXTURE_AS_OF } from "@/server/services/search";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <Explorer
      demo={process.env.DATA_MODE === "fixture"}
      initialAsOf={
        process.env.DATA_MODE === "fixture"
          ? FIXTURE_AS_OF
          : new Date().toISOString()
      }
    />
  );
}
