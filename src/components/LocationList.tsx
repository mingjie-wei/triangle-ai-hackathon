import type { Place } from "@/lib/domain";
export default function LocationList({
  places,
  selected,
  onSelect,
  total,
}: {
  places: Place[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  total: number;
}) {
  return (
    <nav className="location-list" aria-label="Campus places">
      <button
        className={!selected ? "active" : ""}
        onClick={() => onSelect(null)}
      >
        <span className="location-icon">⌘</span>
        <span>
          All campus events<small>Every place, including online</small>
        </span>
        <b>{total}</b>
      </button>
      <div className="section-label">
        ON THE MAP <span>{places.length} places</span>
      </div>
      {places.map((p) => (
        <button
          key={p.id}
          className={selected === p.id ? "active" : ""}
          onClick={() => onSelect(p.id)}
          aria-pressed={selected === p.id}
        >
          <span className="location-icon">
            {p.slug === "duke-chapel" ? "♧" : "▥"}
          </span>
          <span>
            {p.name}
            <small>{p.kind}</small>
          </span>
          <b>{p.count ?? 0}</b>
        </button>
      ))}
    </nav>
  );
}
