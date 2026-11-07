"use client";
import { useEffect, useRef, type ReactNode } from "react";
import type { Place } from "@/lib/domain";
import { westCampus } from "@/lib/campus-world";
import { landmarks } from "@/lib/presentation";

export default function BuildingDialog({
  open,
  place,
  onClose,
  onLocate,
  onWalk,
  filterSummary,
  onClearFilters,
  children,
}: {
  open: boolean;
  place: Place | null;
  onClose: () => void;
  onLocate: () => void;
  onWalk: () => void;
  filterSummary: string;
  onClearFilters: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const placement = westCampus.placements.find((p) => p.slug === place?.slug);
  const info = landmarks.find((l) => l.slug === place?.slug);
  useEffect(() => {
    const el = dialog.current;
    if (!el || !open) return;
    const invoker = document.activeElement;
    // Let the map's scheduled selection reveal finish before modal focus moves.
    const frame = requestAnimationFrame(() => {
      el.showModal();
      closeButton.current?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      el.close();
      const target =
        invoker instanceof HTMLElement &&
        invoker.isConnected &&
        invoker.getClientRects().length
          ? invoker
          : document.querySelector<HTMLElement>(".map-surface");
      target?.focus({ preventScroll: true });
    };
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="building-dialog paper"
      aria-labelledby="building-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const controls = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href],input,select,textarea,[tabindex='0']",
          ),
        ).filter((node) => node.getClientRects().length > 0);
        const first = controls[0],
          last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
    >
      <header className="building-dialog-header">
        <div>
          <span className="eyebrow">
            {place
              ? "WEST CAMPUS / BUILDING GUIDE"
              : "AROUND DUKE / EVENT DISCOVERY"}
          </span>
          <h2 id="building-dialog-title">
            {place?.name ?? "All campus events"}
          </h2>
          <p>{info?.kind ?? "Across campus, other places & online"}</p>
        </div>
        <button
          ref={closeButton}
          className="close-button"
          aria-label="Close building dialog"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className={`building-dialog-scroll ${place ? "with-building" : ""}`}>
        {place && (
          <aside className="building-about">
            {placement /* Original transparent building artwork. */ && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={placement.sprite}
                alt={`Pixel-art illustration of ${place.name}`}
              />
            )}
            <h3>About this building</h3>
            {info?.description && <p>{info.description}</p>}
            {info && (
              <button className="primary-link" onClick={onLocate}>
                ⌖ Locate on map
              </button>
            )}
            {info && (
              <button className="primary-link walk-entrance" onClick={onWalk}>
                Walk there on the map →
              </button>
            )}
            {place.officialMapUrl && (
              <a
                className="official-map-link"
                href={place.officialMapUrl}
                target="_blank"
                rel="noreferrer"
              >
                Official campus map ↗
              </a>
            )}
          </aside>
        )}
        <div className="building-event-column">
          <div className="dialog-filter-summary">
            <span>
              {filterSummary || "All interests · 30-day calendar window"} ·
              Eastern time
            </span>
            {filterSummary && (
              <button className="text-button" onClick={onClearFilters}>
                Clear filters
              </button>
            )}
          </div>
          {children}
        </div>
      </div>
      <footer className="building-dialog-footer">
        <small>
          Official listings remain authoritative. External links open a new tab.
        </small>
        <button className="primary-link" onClick={onClose}>
          Back to exploring
        </button>
      </footer>
    </dialog>
  );
}
