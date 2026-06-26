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

export interface DualFormulation {
  objectiveType: 'minimize' | 'maximize';
  objCoeffs: number[];
  constraints: { coefficients: number[]; op: '<=' | '>=' | '='; rhs: number }[];
}

export interface DualResult {
  status: string;
  isOptimal: boolean;
  optimalZ: number;
  varValues: VarValue[];
  tableHeaders: string[];
  tableRows: TableauRow[];
  formulation: DualFormulation;
  standardized: boolean;
  message?: string;
}

export interface IntegerIncumbent {
  nodeId: number;
  depth: number;
  z: number;
  solution: number[];
}

export interface IntegerLog {
  nodesExplored: number;
  prunedByBound: number;
  prunedByInfeasibility: number;
  maxDepth: number;
  incumbentHistory: IntegerIncumbent[];
}

export interface IntegerResult {
  status: string;
  isOptimal: boolean;
  optimalZ: number;
  varValues: VarValue[];
  tableHeaders: string[];
  tableRows: TableauRow[];
  log: IntegerLog;
  message?: string;
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
  hasMultipleSolutions?: boolean;
  multipleSolutionVars?: string[];
  alternativeSolutions?: VarValue[][];
  dualResult?: DualResult;
  integerResult?: IntegerResult;
  integerFeasiblePoints?: [number, number][];
  integerOptimalPoint?: [number, number];
}
