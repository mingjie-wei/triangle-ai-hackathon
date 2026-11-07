import type { Place } from "@/lib/domain";
export default function CampusMap({
  places,
  selected,
  onSelect,
}: {
  places: Place[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="map-canvas">
      <svg
        className="terrain"
        viewBox="0 0 800 650"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="grain"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="3" r=".8" fill="#b4bea7" opacity=".25" />
          </pattern>
        </defs>
        <rect width="800" height="650" fill="#edf0e3" />
        <path
          d="M0 80 Q160 160 190 0M800 400Q650 450 800 650M0 490Q100 450 110 650"
          fill="none"
          stroke="#dbe3d1"
          strokeWidth="120"
        />
        <path
          d="M-40 320 L220 320 L400 420 L830 420 M400 -10 L400 660 M100 120L690 120L690 650 M-20 550 L800 550"
          fill="none"
          stroke="#d6d6c7"
          strokeWidth="25"
        />
        <path
          d="M-40 320 L220 320 L400 420 L830 420 M400 -10 L400 660 M100 120L690 120L690 650 M-20 550 L800 550"
          fill="none"
          stroke="#faf9ee"
          strokeWidth="20"
        />
        <path
          d="M410 420L690 120M400 420L100 550M220 320L400 120"
          stroke="#faf9ee"
          strokeWidth="10"
          fill="none"
        />
        <rect x="450" y="440" width="180" height="80" rx="35" fill="#dbe5cd" />
        <rect x="440" y="180" width="190" height="75" rx="30" fill="#e1e8d4" />
        {[
          [70, 210],
          [80, 245],
          [100, 275],
          [560, 310],
          [590, 330],
          [620, 320],
          [740, 520],
          [720, 560],
          [110, 430],
          [125, 460],
          [270, 530],
          [290, 555],
          [470, 55],
          [500, 70],
          [530, 55],
          [590, 590],
          [630, 600],
        ].map(([x, y], i) => (
          <g key={i}>
            <ellipse
              cx={x + 3}
              cy={y + 10}
              rx="12"
              ry="7"
              fill="#bbc9ad"
              opacity=".3"
            />
            <path d={`M${x} ${y}v18`} stroke="#9aa98a" strokeWidth="3" />
            <circle cx={x} cy={y} r="13" fill={i % 2 ? "#b3c5a0" : "#c5d2b2"} />
          </g>
        ))}
        <rect width="800" height="650" fill="url(#grain)" />
      </svg>
      <div className="map-wordmark">
        WEST CAMPUS<span>DUKE UNIVERSITY</span>
      </div>
      <span className="quad-label">Abele Quad</span>
      <div className="compass" aria-hidden="true">
        N<span>↑</span>
      </div>
      {places
        .filter((p) => p.x !== null && p.y !== null)
        .map((p) => (
          <button
            key={p.id}
            style={{ left: `${p.x! * 100}%`, top: `${p.y! * 100}%` }}
            className={`map-place ${selected === p.id ? "selected" : ""}`}
            aria-pressed={selected === p.id}
            aria-label={`${p.name}, ${p.count ?? 0} matching events`}
            onClick={() => onSelect(p.id)}
          >
            <span
              className={`building ${p.slug === "duke-chapel" ? "chapel" : ""}`}
              aria-hidden="true"
            >
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="place-label">
              {p.name}
              <b>{p.count ?? 0}</b>
            </span>
          </button>
        ))}
      <div className="map-key">
        <span /> Explore a place <span className="key-selected" /> Selected
        place
      </div>
      <div className="map-disclaimer">
        Illustrative map · Not for navigation
      </div>
    </div>
  );
}
