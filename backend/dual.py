"""
JPAD Simplex - Dual Problem
===========================

Constroi e resolve o problema dual a partir do primal, reaproveitando o motor
``SimplexSolver``. A apresentacao do dual eh um dos itens de bonificacao do
trabalho de Pesquisa Operacional.

Casos simetricos (sem padronizacao):
  - max + todas as restricoes <=   -->   min + todas >=
  - min + todas as restricoes >=   -->   max + todas <=

Caso geral (com padronizacao para max + <=):
  - Restricao >= eh multiplicada por -1 para virar <=.
  - Restricao = eh dividida em duas restricoes <= (gera duas variaveis duais).
  - Se o objetivo eh min, negamos c (max -c'x); Z* eh re-negado no final.

Em qualquer caso, vale a propriedade da dualidade forte:
    Z* do dual == Z* do primal.
"""

from simplex import SimplexSolver


def _transpose(M):
    """Transposta de uma matriz representada como lista de listas."""
    if not M:
        return []
    rows, cols = len(M), len(M[0])
    return [[M[i][j] for i in range(rows)] for j in range(cols)]


def build_dual_problem(c, A, b, constraint_types, objective):
    """Constroi o problema dual a partir do primal."""
    obj = objective.strip().lower()
    n = len(c)
    m = len(A)

    is_max_le = (obj == 'max' and all(ct == '<=' for ct in constraint_types))
    is_min_ge = (obj == 'min' and all(ct == '>=' for ct in constraint_types))

    if is_max_le:
        # max c'x, Ax<=b, x>=0  -->  min b'y, A'y>=c, y>=0
        return {
            'c': list(b), 'A': _transpose(A), 'b': list(c),
            'constraint_types': ['>='] * n, 'objective': 'min',
            'standardized': False, 'sign_z_flip': False,
            'var_origin': list(range(m)),
        }

    if is_min_ge:
        # min c'x, Ax>=b, x>=0  -->  max b'y, A'y<=c, y>=0
        return {
            'c': list(b), 'A': _transpose(A), 'b': list(c),
            'constraint_types': ['<='] * n, 'objective': 'max',
            'standardized': False, 'sign_z_flip': False,
            'var_origin': list(range(m)),
        }

    # Caso geral: padronizar primal para max + <=, entao dualizar.
    sign_obj = 1.0 if obj == 'max' else -1.0
    c_std = [sign_obj * ci for ci in c]
    A_std, b_std, var_origin = [], [], []
    for i, ct in enumerate(constraint_types):
        if ct == '<=':
            A_std.append(list(A[i])); b_std.append(b[i]); var_origin.append(i)
        elif ct == '>=':
            A_std.append([-v for v in A[i]]); b_std.append(-b[i]); var_origin.append(i)
        elif ct == '=':
            A_std.append(list(A[i])); b_std.append(b[i]); var_origin.append(i)
            A_std.append([-v for v in A[i]]); b_std.append(-b[i]); var_origin.append(i)

    return {
        'c': list(b_std), 'A': _transpose(A_std), 'b': list(c_std),
        'constraint_types': ['>='] * n, 'objective': 'min',
        'standardized': True, 'sign_z_flip': (sign_obj < 0),
        'var_origin': var_origin,
    }


def solve_dual(c, A, b, constraint_types, objective):
    """Constroi e resolve o problema dual.
    Retorna (solver, result, dual_problem)."""
    dp = build_dual_problem(c, A, b, constraint_types, objective)
    var_names = [f"y{i + 1}" for i in range(len(dp['c']))]

    solver = SimplexSolver(
        c=dp['c'], A=dp['A'], b=dp['b'],
        constraint_types=dp['constraint_types'],
        objective=dp['objective'],
        variable_names=var_names,
    )
    result = solver.solve(verbose=False)

    # Re-negacao do Z* para problemas padronizados com objetivo invertido (min -> max).
    if dp['sign_z_flip'] and result.get('optimal_value') is not None:
        result['optimal_value'] = -result['optimal_value']

    return solver, result, dp
