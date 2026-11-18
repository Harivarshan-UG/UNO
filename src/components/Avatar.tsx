"use client";

/**
 * 8 inline SVG avatars. Pure code, no PNG assets — each is a colourful round
 * tile with a distinct face/pattern. Rendered at any size via a `size` prop;
 * the SVG scales cleanly so the same component serves the picker grid, the
 * player's seat marker, and the lobby roster.
 */

export const AVATAR_COUNT = 8;

type AvatarDef = {
  bg: string; // CSS color
  accent: string;
  draw: (s: number) => React.ReactNode;
};

// Design goals: each avatar has a bold flat colour, a simple expression, and
// reads at ~32px. No photoreal faces — geometric mascots.
const AVATARS: AvatarDef[] = [
  {
    bg: "#F85C1E",
    accent: "#FFF6E3",
    draw: (s) => (
      <g>
        <circle cx={s / 2} cy={s * 0.45} r={s * 0.06} fill="#2B2A27" />
        <circle cx={s * 0.65} cy={s * 0.45} r={s * 0.06} fill="#2B2A27" />
        <path
          d={`M ${s * 0.38} ${s * 0.65} Q ${s / 2} ${s * 0.78} ${s * 0.62} ${s * 0.65}`}
          stroke="#2B2A27"
          strokeWidth={s * 0.05}
          fill="none"
          strokeLinecap="round"
        />
      </g>
    ),
  },
  {
    bg: "#3F82E0",
    accent: "#E3F2FF",
    draw: (s) => (
      <g>
        <rect x={s * 0.32} y={s * 0.4} width={s * 0.1} height={s * 0.12} rx={s * 0.03} fill="#2B2A27" />
        <rect x={s * 0.58} y={s * 0.4} width={s * 0.1} height={s * 0.12} rx={s * 0.03} fill="#2B2A27" />
        <rect x={s * 0.35} y={s * 0.68} width={s * 0.3} height={s * 0.06} rx={s * 0.03} fill="#2B2A27" />
      </g>
    ),
  },
  {
    bg: "#3DAE4A",
    accent: "#E6F6E6",
    draw: (s) => (
      <g>
        <path d={`M ${s * 0.3} ${s * 0.45} L ${s * 0.42} ${s * 0.55} L ${s * 0.3} ${s * 0.6} Z`} fill="#2B2A27" />
        <path d={`M ${s * 0.7} ${s * 0.45} L ${s * 0.58} ${s * 0.55} L ${s * 0.7} ${s * 0.6} Z`} fill="#2B2A27" />
        <circle cx={s / 2} cy={s * 0.72} r={s * 0.06} fill="#2B2A27" />
      </g>
    ),
  },
  {
    bg: "#EAC24C",
    accent: "#FFF9E0",
    draw: (s) => (
      <g>
        <circle cx={s * 0.37} cy={s * 0.5} r={s * 0.07} fill="#2B2A27" />
        <circle cx={s * 0.63} cy={s * 0.5} r={s * 0.07} fill="#2B2A27" />
        <circle cx={s * 0.37} cy={s * 0.48} r={s * 0.025} fill="#FFF" />
        <circle cx={s * 0.63} cy={s * 0.48} r={s * 0.025} fill="#FFF" />
        <path
          d={`M ${s * 0.35} ${s * 0.72} Q ${s / 2} ${s * 0.68} ${s * 0.65} ${s * 0.72}`}
          stroke="#2B2A27"
          strokeWidth={s * 0.045}
          fill="none"
          strokeLinecap="round"
        />
      </g>
    ),
  },
  {
    bg: "#A058E3",
    accent: "#F0E5FF",
    draw: (s) => (
      <g>
        <path
          d={`M ${s * 0.3} ${s * 0.5} Q ${s * 0.37} ${s * 0.42} ${s * 0.44} ${s * 0.5}`}
          stroke="#2B2A27"
          strokeWidth={s * 0.05}
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={`M ${s * 0.56} ${s * 0.5} Q ${s * 0.63} ${s * 0.42} ${s * 0.7} ${s * 0.5}`}
          stroke="#2B2A27"
          strokeWidth={s * 0.05}
          fill="none"
          strokeLinecap="round"
        />
        <circle cx={s / 2} cy={s * 0.68} r={s * 0.08} fill="#2B2A27" />
      </g>
    ),
  },
  {
    bg: "#20C4A8",
    accent: "#D7F7EF",
    draw: (s) => (
      <g>
        <polygon
          points={`${s * 0.33},${s * 0.42} ${s * 0.44},${s * 0.52} ${s * 0.33},${s * 0.52}`}
          fill="#2B2A27"
        />
        <polygon
          points={`${s * 0.67},${s * 0.42} ${s * 0.56},${s * 0.52} ${s * 0.67},${s * 0.52}`}
          fill="#2B2A27"
        />
        <path
          d={`M ${s * 0.4} ${s * 0.7} L ${s * 0.6} ${s * 0.7}`}
          stroke="#2B2A27"
          strokeWidth={s * 0.05}
          strokeLinecap="round"
        />
      </g>
    ),
  },
  {
    bg: "#E7488F",
    accent: "#FFE6F0",
    draw: (s) => (
      <g>
        <path
          d={`M ${s * 0.32} ${s * 0.5} L ${s * 0.44} ${s * 0.5}`}
          stroke="#2B2A27"
          strokeWidth={s * 0.06}
          strokeLinecap="round"
        />
        <path
          d={`M ${s * 0.56} ${s * 0.5} L ${s * 0.68} ${s * 0.5}`}
          stroke="#2B2A27"
          strokeWidth={s * 0.06}
          strokeLinecap="round"
        />
        <path
          d={`M ${s * 0.38} ${s * 0.68} Q ${s / 2} ${s * 0.78} ${s * 0.62} ${s * 0.68} Q ${s / 2} ${s * 0.74} ${s * 0.38} ${s * 0.68}`}
          fill="#2B2A27"
        />
      </g>
    ),
  },
  {
    bg: "#2B2A27",
    accent: "#FFF6E3",
    draw: (s) => (
      <g>
        <circle cx={s * 0.37} cy={s * 0.5} r={s * 0.06} fill="#FFF6E3" />
        <circle cx={s * 0.63} cy={s * 0.5} r={s * 0.06} fill="#FFF6E3" />
        <path
          d={`M ${s * 0.4} ${s * 0.7} L ${s * 0.6} ${s * 0.7}`}
          stroke="#FFF6E3"
          strokeWidth={s * 0.05}
          strokeLinecap="round"
        />
      </g>
    ),
  },
];

/** The default avatar for a seat if the player never picked one. */
export function defaultAvatarId(seat: number): number {
  return ((seat % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT;
}

/** Render an SVG avatar at the given pixel size. */
export function Avatar({
  id,
  size = 40,
  selected = false,
}: {
  id: number;
  size?: number;
  selected?: boolean;
}) {
  const safeId = ((id % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT;
  const a = AVATARS[safeId];
  const ring = selected ? "3" : "0";
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: "block" }}
      aria-hidden
    >
      <defs>
        <radialGradient id={`av-hl-${safeId}`} cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={size / 2 - Number(ring)}
        fill={a.bg}
        stroke={selected ? "#2B2A27" : "none"}
        strokeWidth={ring}
      />
      <circle cx={size / 2} cy={size / 2} r={size / 2 - Number(ring)} fill={`url(#av-hl-${safeId})`} />
      {a.draw(size)}
    </svg>
  );
}

/** Background colour of an avatar — useful for seat accents. */
export function avatarBg(id: number): string {
  const safeId = ((id % AVATAR_COUNT) + AVATAR_COUNT) % AVATAR_COUNT;
  return AVATARS[safeId].bg;
}
