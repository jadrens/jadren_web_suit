import type { ReactNode } from "react";

const OUTER = { x: 2.5, y: 2.5, width: 19, height: 19 };

function InnerRect({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return <rect x={x} y={y} width={width} height={height} rx={0.75} />;
}

export default function IdsOperatorIcon({ operator }: { operator: string }) {
  let marks: ReactNode = null;
  switch (operator) {
    case "⿰":
      marks = <line x1="12" y1={OUTER.y} x2="12" y2={OUTER.y + OUTER.height} />;
      break;
    case "⿱":
      marks = <line x1={OUTER.x} y1="12" x2={OUTER.x + OUTER.width} y2="12" />;
      break;
    case "⿲":
      marks = (
        <>
          <line x1="8.3" y1={OUTER.y} x2="8.3" y2={OUTER.y + OUTER.height} />
          <line x1="15.7" y1={OUTER.y} x2="15.7" y2={OUTER.y + OUTER.height} />
        </>
      );
      break;
    case "⿳":
      marks = (
        <>
          <line x1={OUTER.x} y1="8.3" x2={OUTER.x + OUTER.width} y2="8.3" />
          <line x1={OUTER.x} y1="15.7" x2={OUTER.x + OUTER.width} y2="15.7" />
        </>
      );
      break;
    case "⿴":
      marks = <InnerRect x={6.5} y={6.5} width={11} height={11} />;
      break;
    case "⿵":
      marks = <InnerRect x={6.5} y={11} width={11} height={9} />;
      break;
    case "⿶":
      marks = <InnerRect x={6.5} y={4} width={11} height={9} />;
      break;
    case "⿷":
      marks = <InnerRect x={11} y={6.5} width={9} height={11} />;
      break;
    case "⿸":
      marks = <InnerRect x={11} y={11} width={9} height={9} />;
      break;
    case "⿹":
      marks = <InnerRect x={4} y={11} width={9} height={9} />;
      break;
    case "⿺":
      marks = <InnerRect x={11} y={4} width={9} height={9} />;
      break;
    case "⿻":
      marks = <rect x="7" y="7" width="12" height="12" rx={0.75} transform="rotate(45 12 12)" />;
      break;
    default:
      marks = null;
  }

  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect
        x={OUTER.x}
        y={OUTER.y}
        width={OUTER.width}
        height={OUTER.height}
        rx={1}
        strokeDasharray="2 2"
        opacity={0.5}
      />
      {marks}
    </svg>
  );
}
