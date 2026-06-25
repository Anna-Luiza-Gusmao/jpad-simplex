"""
JPAD Simplex - HTTP API Layer
=============================

Thin Flask layer that connects the React front-end to the existing
``SimplexSolver`` engine (``simplex.py``) WITHOUT modifying the solver.

Flow:
1. Receive a Linear Programming Problem in the front-end's JSON shape.
2. Translate it into the inputs expected by ``SimplexSolver``.
3. Run the real Simplex algorithm (Big-M).
4. Return the optimal solution AND the real final tableau, shaped to match
   the front-end's ``SimplexResult`` contract.

The 2D chart geometry stays on the client (pure visualization concern).

Run:
    pip install -r requirements.txt
    python api.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS

from simplex import SimplexSolver
from dual import solve_dual
from branch_and_bound import solve_integer

app = Flask(__name__)
CORS(app)  # Allows the Vite dev server (localhost:5173) to call this API.

DISPLAY_EPS = 1e-7  # Values below this are snapped to 0 for a clean tableau.


def _to_float(value, default=0.0):
    """Safely parse a value coming as string/number from the front-end."""
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _snap(value):
    """Round for display and collapse tiny floating-point residuals to 0."""
    v = float(value)
    return 0.0 if abs(v) < DISPLAY_EPS else round(v, 6)


def _display_name(name):
    """Map internal slack 's1' -> 'F1' (Folga) to match the UI style."""
    return ("F" + name[1:]) if name.startswith("s") else name


def parse_problem(payload):
    """Translate the front-end SimplexProblem JSON into solver arguments."""
    objective_type = payload.get("objectiveType", "maximize")
    objective = "min" if str(objective_type).lower().startswith("min") else "max"

    num_vars = int(payload.get("numVars", 0))
    obj_coeffs = payload.get("objCoeffs", [])
    constraints = payload.get("constraints", [])

    c = [_to_float(obj_coeffs[i]) if i < len(obj_coeffs) else 0.0
         for i in range(num_vars)]

    A, b, constraint_types = [], [], []
    for row in constraints:
        coeffs = row.get("coefficients", [])
        A.append([_to_float(coeffs[i]) if i < len(coeffs) else 0.0
                  for i in range(num_vars)])
        b.append(_to_float(row.get("rhs")))
        constraint_types.append(row.get("op", "<="))

    variable_names = [f"x{i + 1}" for i in range(num_vars)]

    return {
        "c": c, "A": A, "b": b,
        "constraint_types": constraint_types,
        "objective": objective,
        "variable_names": variable_names,
    }


def build_tableau_view(solver):
    """Build (tableHeaders, tableRows) from the solver's REAL final tableau.

    Artificial (Big-M) columns are omitted, as is standard when presenting a
    final optimal tableau. The Z row is last and its RHS is the corrected
    optimal value.
    """
    T = solver.tableau
    m = T.shape[0] - 1
    n_total = solver.n_total
    artificial = set(solver.artificial_indices)

    keep_cols = [j for j in range(n_total) if j not in artificial]
    names = [_display_name(solver.all_var_names[j]) for j in keep_cols]
    headers = ["Base"] + names + ["b"]

    rows = []
    for i in range(m):
        base_name = _display_name(solver.all_var_names[solver.basis[i]])
        values = [_snap(T[i, j]) for j in keep_cols] + [_snap(T[i, -1])]
        rows.append({"base": base_name, "values": values})

    z_values = [_snap(T[-1, j]) for j in keep_cols]
    z_rhs = solver.optimal_value if solver.optimal_value is not None else T[-1, -1]
    z_values.append(_snap(z_rhs))
    rows.append({"base": "Z", "values": z_values})

    return headers, rows


def build_dual_response(dual_solver, dual_result, dual_problem):
    """Monta o sub-objeto ``dualResult`` para a resposta da API.

    Inclui a formulacao do problema dual (para a interface exibir), os valores
    ótimos das variaveis duais, o tableau final e flags de padronizacao.
    """
    status = dual_result['status']

    var_values = []
    if dual_result['solution'] is not None:
        for i, val in enumerate(dual_result['solution']):
            var_values.append({"name": "y", "index": i + 1, "value": _snap(val)})

    optimal_z = (_snap(dual_result['optimal_value'])
                 if dual_result['optimal_value'] is not None else 0.0)

    headers, rows = build_tableau_view(dual_solver)

    formulation = {
        "objectiveType": "minimize" if dual_problem['objective'] == 'min' else "maximize",
        "objCoeffs": [_snap(v) for v in dual_problem['c']],
        "constraints": [
            {
                "coefficients": [_snap(v) for v in dual_problem['A'][j]],
                "op": dual_problem['constraint_types'][j],
                "rhs": _snap(dual_problem['b'][j]),
            }
            for j in range(len(dual_problem['A']))
        ],
    }

    return {
        "status": status,
        "isOptimal": status == "optimal",
        "optimalZ": optimal_z,
        "varValues": var_values,
        "tableHeaders": headers,
        "tableRows": rows,
        "formulation": formulation,
        "standardized": dual_problem['standardized'],
    }


def build_integer_response(integer_result):
    """Monta o sub-objeto ``integerResult`` para a resposta da API.

    Inclui a solução inteira encontrada (valores das variáveis e Z*), o
    tableau final do nó vencedor (mesmo formato do primal) e o log da
    exploração Branch & Bound (número de nós, podas, profundidade máxima e
    histórico de incumbentes).
    """
    status = integer_result['status']
    is_optimal = status == 'optimal'

    var_values = []
    if integer_result['solution'] is not None:
        for i, val in enumerate(integer_result['solution']):
            var_values.append({"name": "x", "index": i + 1, "value": _snap(val)})

    optimal_z = (_snap(integer_result['optimal_value'])
                 if integer_result['optimal_value'] is not None else 0.0)

    # Tableau do nó vencedor (ou raiz, se nada foi encontrado).
    headers, rows = build_tableau_view(integer_result['final_solver'])

    log = integer_result['log']
    log_payload = {
        "nodesExplored": log['nodes_explored'],
        "prunedByBound": log['pruned_by_bound'],
        "prunedByInfeasibility": log['pruned_by_infeasibility'],
        "maxDepth": log['max_depth'],
        "incumbentHistory": [
            {
                "nodeId": h['node_id'],
                "depth": h['depth'],
                "z": _snap(h['z']),
                "solution": [int(v) for v in h['solution']],
            }
            for h in log['incumbent_history']
        ],
    }

    response = {
        "status": status,
        "isOptimal": is_optimal,
        "optimalZ": optimal_z,
        "varValues": var_values,
        "tableHeaders": headers,
        "tableRows": rows,
        "log": log_payload,
    }

    if status == 'node_limit':
        response["message"] = (
            f"Limite de nós atingido ({log['nodes_explored']} explorados). "
            "A solução reportada eh a melhor encontrada até o limite."
        )
    elif status == 'infeasible':
        response["message"] = "Não existe solução inteira viável para o problema."
    elif status == 'unbounded':
        response["message"] = "O problema eh ilimitado mesmo na relaxação linear."

    return response


def build_response(solver, result, num_vars, num_constraints):
    """Assemble the JSON payload consumed by the front-end."""
    status = result["status"]
    solution = result["solution"]

    var_values = []
    if solution is not None:
        for i, val in enumerate(solution):
            var_values.append({"name": "x", "index": i + 1, "value": _snap(val)})

    is_integer = (all(abs(v["value"] - round(v["value"])) < 1e-6 for v in var_values)
                  if var_values else False)

    optimal_z = _snap(result["optimal_value"]) if result["optimal_value"] is not None else 0.0
    headers, rows = build_tableau_view(solver)

    # Convert alternative solutions (raw numpy arrays from the solver) into the
    # same VarValue shape the front-end already uses for the primary solution.
    alternative_solutions = []
    for alt in result.get("alternative_solutions", []) or []:
        alternative_solutions.append([
            {"name": "x", "index": i + 1, "value": _snap(val)}
            for i, val in enumerate(alt)
        ])

    return {
        "status": status,
        "isOptimal": status == "optimal",
        "optimalZ": optimal_z,
        "varValues": var_values,
        "isInteger": is_integer,
        "hasDual": num_constraints >= num_vars,
        "tableHeaders": headers,
        "tableRows": rows,
        "hasMultipleSolutions": result["has_multiple_solutions"],
        "multipleSolutionVars": result["multiple_solution_vars"],
        "alternativeSolutions": alternative_solutions,
    }


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "jpad-simplex-api"})


@app.route("/solve", methods=["POST"])
def solve():
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"message": "Corpo da requisicao ausente ou invalido (JSON esperado)."}), 400

    try:
        args = parse_problem(payload)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"message": f"Falha ao interpretar o problema: {exc}"}), 400

    if not args["c"]:
        return jsonify({"message": "Defina ao menos uma variavel de decisao."}), 400
    if not args["A"]:
        return jsonify({"message": "Defina ao menos uma restricao."}), 400

    try:
        solver = SimplexSolver(
            c=args["c"], A=args["A"], b=args["b"],
            constraint_types=args["constraint_types"],
            objective=args["objective"],
            variable_names=args["variable_names"],
        )
        result = solver.solve(verbose=False)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"message": f"Erro durante a resolucao: {exc}"}), 500

    response = build_response(solver, result,
                             num_vars=len(args["c"]),
                             num_constraints=len(args["A"]))

    # Optionally compute the dual when requested (bonus item).
    if payload.get("calcDual") and result['status'] == 'optimal':
        try:
            d_solver, d_result, d_problem = solve_dual(
                args["c"], args["A"], args["b"],
                args["constraint_types"], args["objective"],
            )
            response["dualResult"] = build_dual_response(d_solver, d_result, d_problem)
        except Exception as exc:  # noqa: BLE001
            response["dualResult"] = {"status": "error", "message": f"Falha ao resolver o dual: {exc}"}

    # Optionally compute the integer (B&B) solution when requested (bonus item).
    if payload.get("seekInteger") and result['status'] == 'optimal':
        try:
            integer_result = solve_integer(
                args["c"], args["A"], args["b"],
                args["constraint_types"], args["objective"],
                variable_names=args["variable_names"],
            )
            response["integerResult"] = build_integer_response(integer_result)
        except Exception as exc:  # noqa: BLE001
            response["integerResult"] = {"status": "error", "message": f"Falha ao resolver a solucao inteira: {exc}"}

    return jsonify(response)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
