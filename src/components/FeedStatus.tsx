import type { Meta } from "@/lib/domain";
export default function FeedStatus({
  meta,
  demo,
}: {
  meta: Meta | null;
  demo: boolean;
}) {
  return (
    <div className={`feed-status ${meta?.stale ? "stale" : ""}`}>
      <span className="status-dot" />
      {demo
        ? "Demo data · Duke feed snapshot from Nov 6, 2026"
        : meta?.last_successful_sync
          ? `Updated ${new Date(meta.last_successful_sync).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ET`
          : "Awaiting first import"}
      {meta?.stale && " · Index may be out of date"}
      {meta?.last_sync_state === "failed" && " · Latest refresh failed"}
    </div>
  );
}
