"use client";

import type { Card as CardType, Color, Value } from "../engine/types";

/**
 * Procedural SVG cards. Every face is drawn from the Card type instead of
 * loaded as a PNG, so adding a new value (draw5, skip_all, flip) is a code
 * change not an art change. The outer component API matches the previous
 * PNG-based one (same props, same sizes) so callers keep working.
 *
 * Design: bold rounded panel in the card's colour with a cream border, a tilted
 * cream oval in the middle holding the main glyph, and two small corner tags.
 * The design is deliberately UNO-STYLE (classic layout, corner labels, tilted
 * oval) but not UNO-BRANDED — it uses our own palette and does not reproduce
 * Mattel's trade dress.
 */

const WIDTHS = { sm: 60, md: 104, lg: 132 } as const;
const RATIO = 1.5; // card height / width

export function CardFace({
  card,
  onClick,
  size = "md",
  width,
  playable,
  highlight,
}: {
  card: CardType;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
  width?: number;
  playable?: boolean;
  highlight?: boolean;
}) {
  const w = width ?? WIDTHS[size];
  const interactive = !!onClick && !!playable;
  const radius = Math.max(4, Math.round(w * 0.1));
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      style={{ width: w }}
      className={`card-face relative shrink-0 transition-transform duration-150 ${
        interactive ? "hover:-translate-y-3 cursor-pointer" : "cursor-default"
      } ${highlight ? "-translate-y-2" : ""}`}
      aria-label={`${card.color ?? "wild"} ${card.value}`}
    >
      <CardFaceSVG card={card} width={w} />
      {highlight && (
        <span
          aria-hidden
          className="pointer-events-none absolute border-[3px] border-uno-ink"
          style={{ inset: -3, borderRadius: radius + 3 }}
        />
      )}
    </button>
  );
}

export function CardBack({
  size = "sm",
  width,
}: {
  size?: "sm" | "md" | "lg";
  width?: number;
}) {
  const w = width ?? WIDTHS[size];
  return (
    <div style={{ width: w }} className="shrink-0">
      <CardBackSVG width={w} />
    </div>
  );
}

/* ------------------------------------------------------------- SVG internals */

const swatch: Record<Color, string> = {
  red: "#ea4b2f",
  yellow: "#f0b135",
  green: "#52a84b",
  blue: "#2f85d3",
};
const swatchDark: Record<Color, string> = {
  red: "#a82a16",
  yellow: "#b07a1a",
  green: "#2e6b2a",
  blue: "#1b5890",
};

function CardFaceSVG({ card, width }: { card: CardType; width: number }) {
  const h = Math.round(width * RATIO);
  const vb = { w: 100, h: 150 };
  const corner = card.color ? swatch[card.color] : null;
  return (
    <svg
      width={width}
      height={h}
      viewBox={`0 0 ${vb.w} ${vb.h}`}
      style={{ display: "block", filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.2))" }}
    >
      {/* Outer cream frame */}
      <rect x={0} y={0} width={vb.w} height={vb.h} rx={10} ry={10} fill="#f1e7dc" />
      {/* Inner colour panel */}
      {corner ? (
        <rect x={4} y={4} width={vb.w - 8} height={vb.h - 8} rx={7} ry={7} fill={corner} />
      ) : (
        <WildPanel />
      )}
      {/* Tilted cream oval that frames the main glyph */}
      <g transform={`rotate(-20 ${vb.w / 2} ${vb.h / 2})`}>
        <ellipse
          cx={vb.w / 2}
          cy={vb.h / 2}
          rx={38}
          ry={22}
          fill="#f1e7dc"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth={1}
        />
      </g>
      {/* Main glyph in the oval */}
      <CardGlyph value={card.value} color={card.color} cx={vb.w / 2} cy={vb.h / 2} scale={1.5} />
      {/* Corner tags */}
      <CornerTag x={9} y={15} value={card.value} color={card.color} />
      <g transform={`rotate(180 ${vb.w - 9} ${vb.h - 15})`}>
        <CornerTag x={vb.w - 9} y={vb.h - 15} value={card.value} color={card.color} />
      </g>
    </svg>
  );
}

function CardBackSVG({ width }: { width: number }) {
  const h = Math.round(width * RATIO);
  const vb = { w: 100, h: 150 };
  return (
    <svg
      width={width}
      height={h}
      viewBox={`0 0 ${vb.w} ${vb.h}`}
      style={{ display: "block", filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.2))" }}
    >
      <rect x={0} y={0} width={vb.w} height={vb.h} rx={10} ry={10} fill="#f1e7dc" />
      <rect x={4} y={4} width={vb.w - 8} height={vb.h - 8} rx={7} ry={7} fill="#2b2a27" />
      {/* Tilted cream oval with wordmark */}
      <g transform={`rotate(-20 ${vb.w / 2} ${vb.h / 2})`}>
        <ellipse cx={vb.w / 2} cy={vb.h / 2} rx={38} ry={22} fill="#ea4b2f" />
        <text
          x={vb.w / 2}
          y={vb.h / 2 + 9}
          textAnchor="middle"
          fontFamily="Arial Black, Impact, sans-serif"
          fontSize={26}
          fontWeight={900}
          fill="#f1e7dc"
          letterSpacing="2"
        >
          UC
        </text>
      </g>
    </svg>
  );
}

function WildPanel() {
  // Four-colour panel for Wild / Wild +4 cards.
  const cols = [swatch.red, swatch.yellow, swatch.green, swatch.blue];
  return (
    <g>
      <clipPath id="wildClip">
        <rect x={4} y={4} width={92} height={142} rx={7} ry={7} />
      </clipPath>
      <g clipPath="url(#wildClip)">
        <rect x={4} y={4} width={46} height={71} fill={cols[0]} />
        <rect x={50} y={4} width={46} height={71} fill={cols[1]} />
        <rect x={4} y={75} width={46} height={71} fill={cols[2]} />
        <rect x={50} y={75} width={46} height={71} fill={cols[3]} />
      </g>
    </g>
  );
}

function CornerTag({
  x,
  y,
  value,
  color,
}: {
  x: number;
  y: number;
  value: Value;
  color: Color | null;
}) {
  const label = shortLabel(value);
  const fontSize = label.length >= 3 ? 7 : label.length === 2 ? 9 : 11;
  const fill = color ? "#f1e7dc" : "#f1e7dc";
  return (
    <text
      x={x}
      y={y}
      fontFamily="Arial Black, Impact, sans-serif"
      fontSize={fontSize}
      fontWeight={900}
      fill={fill}
      letterSpacing="-0.5"
    >
      {label}
    </text>
  );
}

function CardGlyph({
  value,
  color,
  cx,
  cy,
  scale,
}: {
  value: Value;
  color: Color | null;
  cx: number;
  cy: number;
  scale: number;
}) {
  const stroke = color ? swatchDark[color] : "#2b2a27";
  const fill = color ? swatch[color] : "#2b2a27";

  // Number card — big tilted numeral.
  if (/^[0-9]$/.test(value)) {
    return (
      <text
        x={cx}
        y={cy + 11 * scale}
        textAnchor="middle"
        fontFamily="Arial Black, Impact, sans-serif"
        fontSize={34 * scale}
        fontWeight={900}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.2 * scale}
        paintOrder="stroke"
        transform={`rotate(-20 ${cx} ${cy})`}
      >
        {value}
      </text>
    );
  }

  const label = shortLabel(value);
  return (
    <text
      x={cx}
      y={cy + 7 * scale}
      textAnchor="middle"
      fontFamily="Arial Black, Impact, sans-serif"
      fontSize={label.length >= 3 ? 18 * scale : 24 * scale}
      fontWeight={900}
      fill={fill}
      stroke={stroke}
      strokeWidth={1 * scale}
      paintOrder="stroke"
      transform={`rotate(-20 ${cx} ${cy})`}
    >
      {label}
    </text>
  );
}

function shortLabel(value: Value): string {
  switch (value) {
    case "skip":
      return "⊘";
    case "skip_all":
      return "⊘×";
    case "reverse":
      return "⟲";
    case "draw2":
      return "+2";
    case "draw5":
      return "+5";
    case "flip":
      return "↺";
    case "wild":
      return "W";
    case "wild_draw4":
      return "+4";
    default:
      return value;
  }
}

export function ColorDot({ color }: { color: Color | null }) {
  if (!color) return null;
  return (
    <span
      className="inline-block w-4 h-4 rounded-full border-2 border-uno-ink/20"
      style={{ background: swatch[color] }}
    />
  );
}

export { swatch };
