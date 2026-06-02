export type ObjectiveType = 'maximize' | 'minimize';
export type ConstraintOp = '<=' | '>=' | '=';

export interface ConstraintRow {
  id: string;
  coefficients: string[];
  op: ConstraintOp;
  rhs: string;
}

export interface SimplexProblem {
  objectiveType: ObjectiveType;
  numVars: number;
  objCoeffs: string[];
  constraints: ConstraintRow[];
  seekInteger: boolean;
  calcDual: boolean;
}

export interface VarValue {
  name: string;
  index: number;
  value: number;
}

export interface TableauRow {
  base: string;
  values: number[];
}

export interface SimplexResult {
  optimalZ: number;
  varValues: VarValue[];
  isOptimal: boolean;
  isInteger: boolean;
  hasDual: boolean;
  tableHeaders: string[];
  tableRows: TableauRow[];
  feasibleVertices: [number, number][];
  optimalPoint: [number, number];
  chartBounds: { xMax: number; yMax: number };
  twoVarProblem: boolean;
}
