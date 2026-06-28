export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Y axis */}
      <line x1="8" y1="34" x2="8" y2="5" stroke="rgba(255,255,255,0.65)" strokeWidth="1.6" strokeLinecap="round" />
      {/* X axis */}
      <line x1="8" y1="34" x2="35" y2="34" stroke="rgba(255,255,255,0.65)" strokeWidth="1.6" strokeLinecap="round" />
      {/* Feasible region polygon */}
      <polygon
        points="8,34 8,17 17,8 35,13 35,34"
        fill="rgba(255,255,255,0.10)"
        stroke="rgba(255,255,255,0.70)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Level curve (dashed) approaching optimal */}
      <path
        d="M 8,28 Q 22,16 35,13"
        stroke="rgba(255,255,255,0.38)"
        strokeWidth="1.1"
        strokeDasharray="2.5,2.2"
        fill="none"
      />
      {/* Optimal vertex — amber dot */}
      <circle cx="35" cy="13" r="4" fill="#f59e0b" />
      <circle cx="35" cy="13" r="2" fill="#fef3c7" />
    </svg>
  );
}
