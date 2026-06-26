"""
JPAD Simplex - Branch & Bound for Integer Linear Programming
============================================================

Resolve problemas de Programacao Linear Inteira (PLI) atraves do algoritmo de
Branch & Bound, reaproveitando o motor ``SimplexSolver`` para cada subproblema.

Estrategia:
  - Busca best-first: explora primeiro os nos com melhor Z relaxado
    (maior para max, menor para min).
  - Variavel de ramificacao: aquela com a maior parte fracionaria.
  - Podas:
    * inviabilidade (LP do no nao tem solucao otima)
    * limite/bound (Z do no nao pode melhorar o incumbente)
  - Limite de nos: 200 (suficiente para problemas didaticos; protege a UI).

Em qualquer caso, vale o limite teorico:
    Z* inteiro <= Z* continuo (para max),    Z* inteiro >= Z* continuo (para min).
"""

import heapq
import math
from simplex import SimplexSolver


def solve_integer(c, A, b, constraint_types, objective,
                  variable_names=None, max_nodes=200, tol=1e-6):
    """Resolve PLI via Branch & Bound.

    Retorna um dicionario com:
      status        : 'optimal' | 'infeasible' | 'unbounded' | 'node_limit'
      solution      : lista de inteiros (ou None)
      optimal_value : Z* inteiro (ou None)
      final_solver  : SimplexSolver do no vencedor (para o tableau exibido)
      final_result  : dict de resultado retornado pelo solver desse no
      log           : estatisticas da arvore de busca
    """
    n_vars = len(c)
    is_max = (objective.strip().lower() == 'max')

    log = {
        'nodes_explored': 0,
        'pruned_by_bound': 0,
        'pruned_by_infeasibility': 0,
        'max_depth': 0,
        'incumbent_history': [],
    }

    # No raiz: relaxacao LP do problema original.
    root_solver = SimplexSolver(
        c=c, A=list(A), b=list(b),
        constraint_types=list(constraint_types),
        objective=objective, variable_names=variable_names,
    )
    root_result = root_solver.solve(verbose=False)
    log['nodes_explored'] = 1

    if root_result['status'] == 'unbounded':
        return {
            'status': 'unbounded', 'solution': None, 'optimal_value': None,
            'final_solver': root_solver, 'final_result': root_result, 'log': log,
        }
    if root_result['status'] != 'optimal':
        return {
            'status': 'infeasible', 'solution': None, 'optimal_value': None,
            'final_solver': root_solver, 'final_result': root_result, 'log': log,
        }

    # Se a relaxacao ja eh inteira, terminou.
    if _is_integer_solution(root_result['solution'], tol):
        sol_int = [int(round(v)) for v in root_result['solution']]
        log['incumbent_history'].append({
            'node_id': 1, 'depth': 0,
            'z': root_result['optimal_value'], 'solution': sol_int,
        })
        return {
            'status': 'optimal', 'solution': sol_int,
            'optimal_value': root_result['optimal_value'],
            'final_solver': root_solver, 'final_result': root_result, 'log': log,
        }

    # Ramificacao a partir da raiz.
    incumbent = None
    heap = []      # itens: (priority, counter, depth, extra_A, extra_b, extra_ct)
    counter = [0]  # tiebreaker para o heap (mantem estabilidade FIFO em empates)

    def push(prio, depth, eA, eb, ect):
        heapq.heappush(heap, (prio, counter[0], depth, eA, eb, ect))
        counter[0] += 1

    frac_idx, frac_val = _pick_branching_var(root_result['solution'], n_vars, tol)
    floor_v = int(math.floor(frac_val))
    ceil_v = floor_v + 1
    row = [0.0] * n_vars
    row[frac_idx] = 1.0
    prio = -root_result['optimal_value'] if is_max else root_result['optimal_value']
    push(prio, 1, [list(row)], [float(floor_v)], ['<='])
    push(prio, 1, [list(row)], [float(ceil_v)], ['>='])

    while heap and log['nodes_explored'] < max_nodes:
        _, _, depth, eA, eb, ect = heapq.heappop(heap)

        # LP do no atual: restricoes originais + restricoes acumuladas dos ramos.
        solver = SimplexSolver(
            c=c, A=list(A) + eA, b=list(b) + eb,
            constraint_types=list(constraint_types) + ect,
            objective=objective, variable_names=variable_names,
        )
        result = solver.solve(verbose=False)
        log['nodes_explored'] += 1
        log['max_depth'] = max(log['max_depth'], depth)

        if result['status'] != 'optimal':
            log['pruned_by_infeasibility'] += 1
            continue

        Z = result['optimal_value']

        # Poda por bound (limite teorico).
        if incumbent is not None:
            if is_max and Z <= incumbent['optimal_value'] + tol:
                log['pruned_by_bound'] += 1
                continue
            if not is_max and Z >= incumbent['optimal_value'] - tol:
                log['pruned_by_bound'] += 1
                continue

        # Solucao inteira? Eh folha: atualiza incumbente e nao ramifica.
        if _is_integer_solution(result['solution'], tol):
            sol_int = [int(round(v)) for v in result['solution']]
            better = (incumbent is None
                      or (is_max and Z > incumbent['optimal_value'])
                      or (not is_max and Z < incumbent['optimal_value']))
            if better:
                incumbent = {
                    'solution': sol_int, 'optimal_value': Z,
                    'final_solver': solver, 'final_result': result,
                }
                log['incumbent_history'].append({
                    'node_id': log['nodes_explored'], 'depth': depth,
                    'z': Z, 'solution': sol_int,
                })
            continue

        # Caso contrario, ramifica na variavel com maior fracao.
        fi, fv = _pick_branching_var(result['solution'], n_vars, tol)
        if fi is None:
            continue
        fl = int(math.floor(fv))
        cl = fl + 1
        r = [0.0] * n_vars
        r[fi] = 1.0
        next_prio = -Z if is_max else Z
        push(next_prio, depth + 1, eA + [list(r)], eb + [float(fl)], ect + ['<='])
        push(next_prio, depth + 1, eA + [list(r)], eb + [float(cl)], ect + ['>='])

    # Resultado final.
    if incumbent is None:
        status = 'node_limit' if log['nodes_explored'] >= max_nodes else 'infeasible'
        return {
            'status': status, 'solution': None, 'optimal_value': None,
            'final_solver': root_solver, 'final_result': root_result, 'log': log,
        }

    status = 'node_limit' if (log['nodes_explored'] >= max_nodes and heap) else 'optimal'
    return {
        'status': status,
        'solution': incumbent['solution'],
        'optimal_value': incumbent['optimal_value'],
        'final_solver': incumbent['final_solver'],
        'final_result': incumbent['final_result'],
        'log': log,
    }


def _is_integer_solution(solution, tol):
    """True se todas as componentes estao a menos de ``tol`` de um inteiro."""
    if solution is None:
        return False
    return all(abs(float(v) - round(float(v))) < tol for v in solution)


def _pick_branching_var(solution, n_vars, tol):
    """Retorna (indice, valor) da variavel com a maior parte fracionaria.
    Retorna (None, None) se nenhuma componente eh fracionaria.
    """
    best_idx, best_frac, best_val = None, -1.0, None
    for i in range(n_vars):
        v = float(solution[i])
        frac = abs(v - round(v))
        if frac > tol and frac > best_frac:
            best_idx, best_frac, best_val = i, frac, v
    return best_idx, best_val
