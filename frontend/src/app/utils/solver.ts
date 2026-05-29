import { SimplexProblem, SimplexResult, TableauRow, VarValue } from '../types';

type Point = [number, number];
interface CLine { a: number; b: number; c: number; op: string; }

function lineIntersect(
  a1: number, b1: number, c1: number,
  a2: number, b2: number, c2: number
): Point | null {
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-10) return null;
  return [(c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det];
}

function satisfiesAll(x: number, y: number, lines: CLine[]): boolean {
  return lines.every(l => {
    const v = l.a * x + l.b * y;
    if (l.op === '<=') return v <= l.c + 1e-8;
    if (l.op === '>=') return v >= l.c - 1e-8;
    return Math.abs(v - l.c) < 1e-8;
  });
}

function sortCCW(pts: Point[]): Point[] {
  if (pts.length === 0) return [];
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [...pts].sort((a, b) =>
    Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx)
  );
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

export function mockSolve(problem: SimplexProblem): SimplexResult {
  const n = problem.numVars;
  const m = problem.constraints.length;
  const twoVarProblem = n === 2;

  let optimalZ = 0;
  let varValues: VarValue[] = [];
  let feasibleVertices: Point[] = [];
  let optimalPoint: Point = [0, 0];
  let chartBounds = { xMax: 10, yMax: 10 };

  if (twoVarProblem) {
    const lines: CLine[] = [
      { a: 1, b: 0, c: 0, op: '>=' },
      { a: 0, b: 1, c: 0, op: '>=' },
    ];
    for (const c of problem.constraints) {
      lines.push({
        a: parseFloat(c.coefficients[0]) || 0,
        b: parseFloat(c.coefficients[1]) || 0,
        c: parseFloat(c.rhs) || 0,
        op: c.op,
      });
    }

    // Find all pairwise intersections that satisfy all constraints
    const rawPts: Point[] = [];
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const pt = lineIntersect(lines[i].a, lines[i].b, lines[i].c, lines[j].a, lines[j].b, lines[j].c);
        if (pt && pt[0] >= -1e-8 && pt[1] >= -1e-8) {
          const clean: Point = [Math.max(0, round4(pt[0])), Math.max(0, round4(pt[1]))];
          if (satisfiesAll(clean[0], clean[1], lines)) rawPts.push(clean);
        }
      }
    }

    // Deduplicate
    const uniq: Point[] = [];
    for (const p of rawPts) {
      if (!uniq.some(q => Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6)) {
        uniq.push(p);
      }
    }

    feasibleVertices = sortCCW(uniq);

    const c1 = parseFloat(problem.objCoeffs[0]) || 0;
    const c2 = parseFloat(problem.objCoeffs[1]) || 0;

    let bestZ = problem.objectiveType === 'maximize' ? -Infinity : Infinity;
    let bestPt: Point = [0, 0];

    for (const pt of feasibleVertices) {
      const z = c1 * pt[0] + c2 * pt[1];
      const better = problem.objectiveType === 'maximize' ? z > bestZ : z < bestZ;
      if (better) { bestZ = z; bestPt = pt; }
    }

    optimalZ = round4(bestZ === -Infinity || bestZ === Infinity ? 0 : bestZ);
    optimalPoint = bestPt;
    varValues = [
      { name: 'x', index: 1, value: round4(bestPt[0]) },
      { name: 'x', index: 2, value: round4(bestPt[1]) },
    ];

    // Chart bounds
    let xMax = 2, yMax = 2;
    for (const c of problem.constraints) {
      const a = parseFloat(c.coefficients[0]) || 0;
      const b = parseFloat(c.coefficients[1]) || 0;
      const rhs = parseFloat(c.rhs) || 0;
      if (a > 1e-9) xMax = Math.max(xMax, rhs / a);
      if (b > 1e-9) yMax = Math.max(yMax, rhs / b);
    }
    xMax = Math.max(xMax, bestPt[0]) * 1.35;
    yMax = Math.max(yMax, bestPt[1]) * 1.35;
    chartBounds = { xMax: Math.max(xMax, 5), yMax: Math.max(yMax, 5) };

  } else {
    // Heuristic for n != 2
    const coeffs = problem.objCoeffs.map(c => parseFloat(c) || 0);
    const rhsArr = problem.constraints.map(c => parseFloat(c.rhs) || 0);
    const maxRhs = Math.max(...rhsArr, 1);

    varValues = Array.from({ length: n }, (_, i) => {
      const val = coeffs[i] > 0 ? round4(maxRhs / (n + 1) * (i + 1) * 0.5) : 0;
      return { name: 'x', index: i + 1, value: val };
    });
    optimalZ = round4(varValues.reduce((s, v, i) => s + (coeffs[i] || 0) * v.value, 0));
  }

  const isInteger = varValues.every(v => Math.abs(v.value - Math.round(v.value)) < 1e-6);

  // Generate simplex tableau headers — using "F" (folga) for slacks, "b" for RHS
  const tableHeaders = [
    'Base',
    ...Array.from({ length: n }, (_, i) => `x${i + 1}`),
    ...Array.from({ length: m }, (_, i) => `F${i + 1}`),
    'b',
  ];

  // Generate plausible final simplex tableau
  const tableRows: TableauRow[] = [];

  // Shadow prices (plausible positive values for binding constraints)
  const shadowPrices = Array.from({ length: m }, (_, i) => {
    const coeff0 = Math.abs(parseFloat(problem.objCoeffs[0]) || 1);
    return round4(coeff0 * (0.4 + i * 0.35));
  });

  // Basic variable rows first (constraint rows)
  const numBasicRows = Math.min(n, m);
  for (let i = 0; i < m; i++) {
    const row = Array(n + m + 1).fill(0);
    if (i < numBasicRows) {
      row[i] = 1; // identity for this decision var
      for (let j = 0; j < m; j++) {
        const sign = (i + j) % 2 === 0 ? 1 : -1;
        row[n + j] = round4(sign * (0.3 + j * 0.2 * (i + 1) * 0.5));
      }
      row[n + m] = varValues[i]?.value ?? 0;
      tableRows.push({ base: `x${i + 1}`, values: row });
    } else {
      row[n + i] = 1;
      const rhsVal = parseFloat(problem.constraints[i]?.rhs || '0');
      row[n + m] = round4(Math.max(0, rhsVal - (varValues[0]?.value || 0) * (parseFloat(problem.constraints[i]?.coefficients[0] || '0') || 0)));
      tableRows.push({ base: `F${i + 1}`, values: row });
    }
  }

  // Z row LAST (as shown in the reference design)
  tableRows.push({
    base: 'Z',
    values: [...Array(n).fill(0), ...shadowPrices, optimalZ],
  });

  return {
    optimalZ,
    varValues,
    isOptimal: true,
    isInteger,
    hasDual: m >= n,
    tableHeaders,
    tableRows,
    feasibleVertices,
    optimalPoint,
    chartBounds,
    twoVarProblem,
  };
}