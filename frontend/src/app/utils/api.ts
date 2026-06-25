import { SimplexProblem, SimplexResult, VarValue, TableauRow, DualResult, IntegerResult } from '../types';
import { computeGeometry, computeIntegerPoints } from './solver';

/**
 * Base URL of the Python backend (Flask).
 * Override in production via a Vite env var: VITE_API_URL.
 */
const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000';

/** Shape returned by POST /solve on the Python API. */
interface BackendResponse {
  status: 'optimal' | 'infeasible' | 'unbounded' | string;
  isOptimal: boolean;
  optimalZ: number;
  varValues: VarValue[];
  isInteger: boolean;
  hasDual: boolean;
  tableHeaders: string[];
  tableRows: TableauRow[];
  hasMultipleSolutions?: boolean;
  multipleSolutionVars?: string[];
  alternativeSolutions?: VarValue[][];
  dualResult?: DualResult;
  integerResult?: IntegerResult;
  message?: string;
}

/**
 * Sends the problem to the real Python Simplex backend and returns a
 * SimplexResult with the SAME shape the UI already expects.
 *
 * The optimization (and the final tableau) comes from the backend; the 2D
 * chart geometry is computed locally, consistent with the optimal solution
 * returned by the backend.
 */
export async function solveProblem(problem: SimplexProblem): Promise<SimplexResult> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(problem),
    });
  } catch {
    throw new Error(
      'Não foi possível conectar ao servidor de cálculo. ' +
        'Verifique se a API Python está em execução (python api.py).'
    );
  }

  if (!res.ok) {
    let msg = `Erro ${res.status} ao resolver o problema.`;
    try {
      const err = await res.json();
      if (err?.message) msg = err.message;
    } catch {
      /* keep default message */
    }
    throw new Error(msg);
  }

  const data: BackendResponse = await res.json();

  if (data.status === 'infeasible') {
    throw new Error(
      'O problema é inviável: não existe solução que satisfaça todas as restrições.'
    );
  }
  if (data.status === 'unbounded') {
    throw new Error(
      'O problema é ilimitado: a função objetivo pode crescer indefinidamente.'
    );
  }
  if (data.status !== 'optimal') {
    throw new Error(data.message || 'Não foi possível encontrar uma solução ótima.');
  }

  // Chart geometry is a visualization concern and stays on the client.
  const geometry = computeGeometry(problem, data.varValues);

  // Integer-solution overlay for the chart (only when the user requested the
  // integer solution and the backend returned a feasible one).
  const hasIntegerOverlay =
    !!data.integerResult && data.integerResult.isOptimal && data.integerResult.varValues.length >= 2;
  const integerFeasiblePoints = hasIntegerOverlay
    ? computeIntegerPoints(problem, geometry.chartBounds)
    : undefined;
  const integerOptimalPoint: [number, number] | undefined = hasIntegerOverlay
    ? [data.integerResult!.varValues[0].value, data.integerResult!.varValues[1].value]
    : undefined;

  return {
    optimalZ: data.optimalZ,
    varValues: data.varValues,
    isOptimal: data.isOptimal,
    isInteger: data.isInteger,
    hasDual: data.hasDual,
    tableHeaders: data.tableHeaders,
    tableRows: data.tableRows,
    hasMultipleSolutions: data.hasMultipleSolutions,
    multipleSolutionVars: data.multipleSolutionVars,
    alternativeSolutions: data.alternativeSolutions,
    dualResult: data.dualResult,
    integerResult: data.integerResult,
    integerFeasiblePoints,
    integerOptimalPoint,
    ...geometry,
  };
}
