import { SimplexProblem, SimplexResult } from '../types';

interface Props {
  problem: SimplexProblem;
  result: SimplexResult;
}

const W = 460;
const H = 360;
const ML = 52, MR = 20, MT = 16, MB = 48;
const CW = W - ML - MR;
const CH = H - MT - MB;

function toSVG(x: number, y: number, xMax: number, yMax: number): [number, number] {
  return [ML + (x / xMax) * CW, MT + CH - (y / yMax) * CH];
}

function formatTick(n: number) {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function getSegment(
  a: number, b: number, c: number,
  xMax: number, yMax: number
): [[number, number], [number, number]] | null {
  const pts: [number, number][] = [];

  // x=0 → b*y=c → y=c/b
  if (Math.abs(b) > 1e-10) {
    const yv = c / b;
    if (yv >= -1e-9 && yv <= yMax + 1e-9) pts.push([0, Math.max(0, yv)]);
  }
  // y=0 → a*x=c → x=c/a
  if (Math.abs(a) > 1e-10) {
    const xv = c / a;
    if (xv >= -1e-9 && xv <= xMax + 1e-9) pts.push([Math.max(0, xv), 0]);
  }
  // x=xMax → b*y = c - a*xMax
  if (Math.abs(b) > 1e-10) {
    const yv = (c - a * xMax) / b;
    if (yv >= -1e-9 && yv <= yMax + 1e-9) pts.push([xMax, Math.max(0, yv)]);
  }
  // y=yMax → a*x = c - b*yMax
  if (Math.abs(a) > 1e-10) {
    const xv = (c - b * yMax) / a;
    if (xv >= -1e-9 && xv <= xMax + 1e-9) pts.push([Math.max(0, xv), yMax]);
  }

  // Deduplicate
  const uniq: [number, number][] = [];
  for (const p of pts) {
    if (!uniq.some(q => Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6)) {
      uniq.push(p);
    }
  }
  if (uniq.length < 2) return null;
  return [uniq[0], uniq[1]];
}

export function FeasibilityChart({ problem, result }: Props) {
  const { xMax, yMax } = result.chartBounds;
  const { feasibleVertices, optimalPoint, twoVarProblem } = result;

  if (!twoVarProblem) {
    return (
      <div className="flex items-center justify-center h-48 rounded-lg border border-dashed border-slate-300 bg-slate-50">
        <div className="text-center">
          <p className="text-slate-400 text-sm">Visualização gráfica disponível</p>
          <p className="text-slate-400 text-sm">apenas para problemas com 2 variáveis</p>
        </div>
      </div>
    );
  }

  // Ticks
  const xStep = xMax > 20 ? Math.ceil(xMax / 10 / 5) * 5 : xMax > 10 ? 2 : 1;
  const xTicks: number[] = [];
  for (let v = 0; v <= xMax + 1e-9; v += xStep) xTicks.push(round2(v));

  const yStep = yMax > 20 ? Math.ceil(yMax / 10 / 5) * 5 : yMax > 10 ? 2 : 1;
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax + 1e-9; v += yStep) yTicks.push(round2(v));

  const constraintColors = ['#3b82f6', '#ef4444', '#8b5cf6', '#f97316', '#14b8a6'];

  // Feasible region polygon SVG path
  const polyPts = feasibleVertices.map(([x, y]) => toSVG(x, y, xMax, yMax));
  const polyPath = polyPts.length >= 3
    ? polyPts.map(([sx, sy], i) => `${i === 0 ? 'M' : 'L'}${sx.toFixed(1)},${sy.toFixed(1)}`).join(' ') + ' Z'
    : '';

  // Level curves
  const c1 = parseFloat(problem.objCoeffs[0]) || 0;
  const c2 = parseFloat(problem.objCoeffs[1]) || 0;
  const zOpt = result.optimalZ;
  const levelZs = zOpt !== 0 ? [zOpt * 0.25, zOpt * 0.5, zOpt * 0.75, zOpt] : [];

  const [optSX, optSY] = toSVG(optimalPoint[0], optimalPoint[1], xMax, yMax);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="block mx-auto"
        style={{ fontFamily: 'inherit' }}
      >
        {/* Grid */}
        {xTicks.map(v => {
          const [sx] = toSVG(v, 0, xMax, yMax);
          return <line key={`gx${v}`} x1={sx} y1={MT} x2={sx} y2={MT + CH} stroke="#f1f5f9" strokeWidth="1" />;
        })}
        {yTicks.map(v => {
          const [, sy] = toSVG(0, v, xMax, yMax);
          return <line key={`gy${v}`} x1={ML} y1={sy} x2={ML + CW} y2={sy} stroke="#f1f5f9" strokeWidth="1" />;
        })}

        {/* Feasible region fill */}
        {polyPath && (
          <>
            <path d={polyPath} fill="rgba(34,197,94,0.10)" stroke="none" />
            <path d={polyPath} fill="none" stroke="rgba(34,197,94,0.4)" strokeWidth="1.2" strokeDasharray="4,2" />
          </>
        )}

        {/* Level curves */}
        {levelZs.map((z, idx) => {
          const seg = getSegment(c1, c2, z, xMax, yMax);
          if (!seg) return null;
          const [p1, p2] = seg;
          const [sx1, sy1] = toSVG(p1[0], p1[1], xMax, yMax);
          const [sx2, sy2] = toSVG(p2[0], p2[1], xMax, yMax);
          const isOpt = idx === levelZs.length - 1;
          return (
            <line
              key={`lc${z}`}
              x1={sx1} y1={sy1} x2={sx2} y2={sy2}
              stroke={isOpt ? '#f59e0b' : '#94a3b8'}
              strokeWidth={isOpt ? 1.8 : 1}
              strokeDasharray={isOpt ? '6,3' : '4,3'}
              opacity={isOpt ? 0.95 : 0.5}
            />
          );
        })}

        {/* Constraint lines */}
        {problem.constraints.map((c, idx) => {
          const a = parseFloat(c.coefficients[0]) || 0;
          const b = parseFloat(c.coefficients[1]) || 0;
          const rhs = parseFloat(c.rhs) || 0;
          const seg = getSegment(a, b, rhs, xMax, yMax);
          if (!seg) return null;
          const [p1, p2] = seg;
          const [sx1, sy1] = toSVG(p1[0], p1[1], xMax, yMax);
          const [sx2, sy2] = toSVG(p2[0], p2[1], xMax, yMax);
          return (
            <line
              key={`cl${c.id}`}
              x1={sx1} y1={sy1} x2={sx2} y2={sy2}
              stroke={constraintColors[idx % constraintColors.length]}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          );
        })}

        {/* Feasible region vertices */}
        {feasibleVertices.map(([x, y], i) => {
          const [sx, sy] = toSVG(x, y, xMax, yMax);
          return <circle key={`fv${i}`} cx={sx} cy={sy} r="2.5" fill="#64748b" opacity="0.65" />;
        })}

        {/* Optimal point */}
        {result.isOptimal && (
          <>
            <circle cx={optSX} cy={optSY} r="9" fill="rgba(245,158,11,0.18)" />
            <circle cx={optSX} cy={optSY} r="5.5" fill="#f59e0b" />
            <circle cx={optSX} cy={optSY} r="2.5" fill="#fff" />
          </>
        )}

        {/* Axes (drawn on top of grid/region) */}
        <line x1={ML} y1={MT} x2={ML} y2={MT + CH} stroke="#64748b" strokeWidth="1.5" />
        <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} stroke="#64748b" strokeWidth="1.5" />

        {/* X ticks */}
        {xTicks.map(v => {
          const [sx] = toSVG(v, 0, xMax, yMax);
          return (
            <g key={`xt${v}`}>
              <line x1={sx} y1={MT + CH} x2={sx} y2={MT + CH + 4} stroke="#94a3b8" strokeWidth="1" />
              <text x={sx} y={MT + CH + 16} textAnchor="middle" fontSize="10" fill="#94a3b8">
                {formatTick(v)}
              </text>
            </g>
          );
        })}

        {/* Y ticks */}
        {yTicks.filter(v => v > 0).map(v => {
          const [, sy] = toSVG(0, v, xMax, yMax);
          return (
            <g key={`yt${v}`}>
              <line x1={ML - 4} y1={sy} x2={ML} y2={sy} stroke="#94a3b8" strokeWidth="1" />
              <text x={ML - 7} y={sy + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                {formatTick(v)}
              </text>
            </g>
          );
        })}

        {/* Axis labels */}
        <text x={ML + CW / 2} y={H - 5} textAnchor="middle" fontSize="12" fill="#64748b" fontStyle="italic">
          x₁
        </text>
        <text
          x={13}
          y={MT + CH / 2}
          textAnchor="middle"
          fontSize="12"
          fill="#64748b"
          fontStyle="italic"
          transform={`rotate(-90, 13, ${MT + CH / 2})`}
        >
          x₂
        </text>

        {/* Origin */}
        <text x={ML - 7} y={MT + CH + 16} textAnchor="end" fontSize="10" fill="#94a3b8">0</text>
      </svg>
    </div>
  );
}
