import { categoryNames } from "@/lib/domain";
export default function EventFilters({
  query,
  category,
  day,
  food,
  onQuery,
  onCategory,
  onDay,
  onFood,
}: {
  query: string;
  category: string;
  day: string;
  food: boolean;
  onQuery: (s: string) => void;
  onCategory: (s: string) => void;
  onDay: (s: string) => void;
  onFood: (b: boolean) => void;
}) {
  return (
    <div className="filters">
      <label className="search">
        <span aria-hidden="true">⌕</span>
        <input
          aria-label="Search campus events"
          placeholder="Find a talk, a concert, a little inspiration…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        {query && (
          <button aria-label="Clear search" onClick={() => onQuery("")}>
            ×
          </button>
        )}
      </label>
      <div className="filter-row">
        <label>
          <span className="sr-only">Category</span>
          <select value={category} onChange={(e) => onCategory(e.target.value)}>
            <option value="all">All interests</option>
            {Object.entries(categoryNames).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="date-filter">
          <span>{day ? "On" : "Next 30 days"}</span>
          <input
            type="date"
            aria-label="Filter by date"
            value={day}
            onChange={(e) => onDay(e.target.value)}
          />
        </label>
        {day && (
          <button className="text-button" onClick={() => onDay("")}>
            Clear date
          </button>
        )}
        <label className="food-filter">
          <input
            type="checkbox"
            checked={food}
            onChange={(e) => onFood(e.target.checked)}
          />{" "}
          Free food indicated
        </label>
      </div>
    </div>
  );
}
