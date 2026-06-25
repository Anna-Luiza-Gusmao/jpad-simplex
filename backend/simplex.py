import numpy as np

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
BIG_M = 1_000_000   
EPS = 1e-9          
MAX_IT = 200        

# ---------------------------------------------------------------------------
# Core Solver Class
# ---------------------------------------------------------------------------
class SimplexSolver:
    """
    Solves a Linear Programming Problem (LPP) using the Tabular Simplex Method.
    """

    def __init__(self, c, A, b, constraint_types=None, objective='max', variable_names=None):
        self.n_vars = len(c)
        self.n_constraints = len(A)
        self.objective = objective.strip().lower()

        self.c_orig = np.array(c, dtype=float)
        self.A_orig = np.array(A, dtype=float)
        self.b_orig = np.array(b, dtype=float)

        self.constraint_types = list(constraint_types) if constraint_types else ['<='] * self.n_constraints
        self.variable_names = list(variable_names) if variable_names else [f'x{i+1}' for i in range(self.n_vars)]

        self.tableau = None
        self.basis = []
        self.all_var_names = []
        self.n_total = 0
        self.artificial_indices = []

        self.status = None   
        self.solution = None   
        self.optimal_value = None
        self.has_multiple_solutions = False
        self.multiple_solution_vars = []
        self.alternative_solutions = []

    def _build_standard_form(self):
        """
        Converts the LPP into standard form and initializes the Simplex tableau.
        Applies the Big-M method for artificial variables.
        """
        n = self.n_vars
        m = self.n_constraints

        c = -self.c_orig.copy() if self.objective == 'min' else self.c_orig.copy()
        A = self.A_orig.copy()
        b = self.b_orig.copy()
        ct = list(self.constraint_types)

        # Ensure right-hand side (b) is non-negative
        for i in range(m):
            if b[i] < 0:
                b[i] *= -1
                A[i] *= -1
                ct[i] = '>=' if ct[i] == '<=' else '<=' if ct[i] == '>=' else '='

        n_slack = ct.count('<=')
        n_surplus = ct.count('>=')
        n_artificial = ct.count('>=') + ct.count('=')
        self.n_total = n + n_slack + n_surplus + n_artificial

        A_aug = np.zeros((m, self.n_total))
        c_aug = np.zeros(self.n_total)
        A_aug[:, :n] = A
        c_aug[:n] = c

        all_names = self.variable_names.copy()
        self.artificial_indices = []
        # The basis must be indexed by ROW (one basic variable per constraint),
        # so it is initialized with a fixed length and assigned by row index.
        # Appending instead would group entries by variable type and misalign
        # the basis with the tableau rows when constraints are mixed (>=, =, <=).
        self.basis = [-1] * m

        col = n
        s_cnt = e_cnt = a_cnt = 1

        # Pass 1: Slack variables (<=)
        for i, constraint_type in enumerate(ct):
            if constraint_type == '<=':
                A_aug[i, col] = 1.0
                all_names.append(f's{s_cnt}')
                self.basis[i] = col
                col += 1
                s_cnt += 1

        # Pass 2: Surplus and Artificial variables (>=, =)
        for i, constraint_type in enumerate(ct):
            if constraint_type == '>=':
                e_col, a_col = col, col + 1
                A_aug[i, e_col] = -1.0   
                A_aug[i, a_col] = 1.0   
                c_aug[a_col] = -BIG_M
                all_names.extend([f'e{e_cnt}', f'a{a_cnt}'])
                self.artificial_indices.append(a_col)
                self.basis[i] = a_col
                col += 2
                e_cnt += 1
                a_cnt += 1

            elif constraint_type == '=':
                a_col = col
                A_aug[i, a_col] = 1.0
                c_aug[a_col] = -BIG_M
                all_names.append(f'a{a_cnt}')
                self.artificial_indices.append(a_col)
                self.basis[i] = a_col
                col += 1
                a_cnt += 1

        self.n_total = col
        self.all_var_names = all_names

        # Build tableau matrix
        T = np.zeros((m + 1, self.n_total + 1))
        T[:m, :self.n_total] = A_aug[:, :self.n_total]
        T[:m, -1] = b
        T[m, :self.n_total] = -c_aug[:self.n_total]

        # Big-M adjustment for initial basis
        for row_i, bv in enumerate(self.basis):
            if bv in self.artificial_indices:
                T[m] += c_aug[bv] * T[row_i]

        self.tableau = T

    def _pivot_col(self):
        obj_row = self.tableau[-1, :-1]
        col = int(np.argmin(obj_row))
        return col if obj_row[col] < -EPS else -1

    def _pivot_row(self, col):
        b_col = self.tableau[:-1, -1]
        a_col = self.tableau[:-1, col]
        with np.errstate(divide='ignore', invalid='ignore'):
            ratios = np.where(a_col > EPS, b_col / a_col, np.inf)
        
        row = int(np.argmin(ratios))
        return row if not np.isinf(ratios[row]) else -1

    def _do_pivot(self, row, col):
        pivot_val = self.tableau[row, col]
        self.tableau[row] /= pivot_val
        for i in range(self.tableau.shape[0]):
            if i != row:
                self.tableau[i] -= self.tableau[i, col] * self.tableau[row]
        self.basis[row] = col

    def _detect_multiple_solutions(self):
        non_basic = set(range(self.n_total)) - set(self.basis)
        obj_row = self.tableau[-1, :-1]
        return [j for j in non_basic if j < self.n_vars and abs(obj_row[j]) < EPS]

    def _compute_alternative_solution(self, entering_col):
        T_bkp = self.tableau.copy()
        bas_bkp = self.basis.copy()

        row = self._pivot_row(entering_col)
        if row == -1:
            return None

        self._do_pivot(row, entering_col)
        sol = self._extract_solution()

        self.tableau = T_bkp
        self.basis = bas_bkp
        return sol

    def _extract_solution(self):
        sol = np.zeros(self.n_total)
        for i, bv in enumerate(self.basis):
            sol[bv] = self.tableau[i, -1]
        return sol[:self.n_vars]

    @staticmethod
    def _fmt(v, width):
        v = 0.0 if abs(v) < EPS else v
        return f'{v:>{width}.4f}'

    def _format_tableau(self, label):
        m, n = self.tableau.shape[0] - 1, self.n_total
        W = max(9, max((len(nm) for nm in self.all_var_names)) + 2)
        W_b = max(W, 10)
        sep = '-' * (8 + W * n + W_b + 2)

        lines = ['', sep, f' {label} '.center(len(sep), '-'), sep]
        
        hdr = f"{'Basis':<8}" + ''.join(f'{nm:>{W}}' for nm in self.all_var_names) + f"{'b':>{W_b + 2}}"
        lines.extend([hdr, sep])

        for i in range(m):
            row_str = f'{self.all_var_names[self.basis[i]]:<8}'
            row_str += ''.join(self._fmt(self.tableau[i, j], W) for j in range(n))
            row_str += self._fmt(self.tableau[i, -1], W_b + 2)
            lines.append(row_str)

        lines.append(sep)
        obj_str = f"{'z':<8}" + ''.join(self._fmt(self.tableau[-1, j], W) for j in range(n))
        obj_str += self._fmt(self.tableau[-1, -1], W_b + 2)
        lines.extend([obj_str, sep])

        return '\n'.join(lines)

    def _print_solution_banner(self):
        sep = '=' * 55
        print(f'\n{sep}\n  ✅ OPTIMAL SOLUTION FOUND\n{sep}')
        for nm, val in zip(self.variable_names, self.solution):
            print(f'  {nm} = {val:.6g}')
        print(f'  z  = {self.optimal_value:.6g} ({self.objective.upper()})\n{sep}')

    def solve(self, verbose=True):
        self._build_standard_form()

        if verbose:
            print(self._format_tableau('INITIAL TABLEAU (Iter 0)'))

        iteration = 0
        while iteration < MAX_IT:
            col = self._pivot_col()

            # Stopping condition: optimal
            if col == -1:
                if any(bv in self.artificial_indices and self.tableau[i, -1] > EPS for i, bv in enumerate(self.basis)):
                    self.status = 'infeasible'
                    if verbose: print('\n❌ INFEASIBLE: Artificial variable in basis > 0.')
                    return self._build_result()
                
                self.status = 'optimal'
                break

            row = self._pivot_row(col)

            # Stopping condition: unbounded
            if row == -1:
                self.status = 'unbounded'
                if verbose: print('\n⚠️ UNBOUNDED: No positive ratio found.')
                return self._build_result()

            entering = self.all_var_names[col]
            leaving = self.all_var_names[self.basis[row]]
            
            if verbose:
                print(f'\n  → In: {entering} | Out: {leaving} | Pivot: row {row+1}, col {col+1}')

            self._do_pivot(row, col)
            iteration += 1

            if verbose:
                print(self._format_tableau(f'Iteration {iteration}'))
        else:
            self.status = 'unbounded'
            if verbose: print(f'\n⚠️ MAX ITERATIONS ({MAX_IT}) REACHED.')
            return self._build_result()

        self.solution = self._extract_solution()
        z_raw = self.tableau[-1, -1]
        self.optimal_value = z_raw if self.objective == 'max' else -z_raw

        if verbose:
            self._print_solution_banner()

        mult_cols = self._detect_multiple_solutions()
        if mult_cols:
            self.has_multiple_solutions = True
            self.multiple_solution_vars = [self.all_var_names[j] for j in mult_cols]

            if verbose:
                print(f'\n⚡ MULTIPLE SOLUTIONS DETECTED')
                print(f'   Alternative variables: {self.multiple_solution_vars}')

            for j in mult_cols:
                alt = self._compute_alternative_solution(j)
                if alt is not None:
                    self.alternative_solutions.append(alt)
                    if verbose:
                        vals = ' '.join(f'{self.variable_names[k]}={alt[k]:.6g}' for k in range(self.n_vars))
                        print(f'   Alt Solution (pivot {self.all_var_names[j]}): {vals}')

        return self._build_result()

    def _build_result(self):
        return {
            'status': self.status,
            'solution': self.solution,
            'optimal_value': self.optimal_value,
            'variable_names': self.variable_names,
            'has_multiple_solutions': self.has_multiple_solutions,
            'multiple_solution_vars': self.multiple_solution_vars,
            'alternative_solutions': self.alternative_solutions,
        }