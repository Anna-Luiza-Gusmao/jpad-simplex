"""
Radiotherapy Treatment Optimization - Linear Programming
Objective: Maximize tumor radiation dose while respecting healthy tissue limits.
"""

from simplex import SimplexSolver

def main():
    # ------------------------------------------------------------------
    # Problem Definition
    # ------------------------------------------------------------------
    objective_coeffs = [0.4, 0.5]  

    constraints_matrix = [
        [0.3, 0.1],  # Healthy tissue A limit
        [0.5, 0.5],  # Healthy tissue B limit
        [0.6, 0.4],  # Healthy tissue C limit
    ]

    rhs_values = [2.7, 6.0, 6.0]  

    constraint_types = ['<=', '<=', '<=']
    variable_names = ['x1', 'x2']

    # ------------------------------------------------------------------
    # Initialization and Execution
    # ------------------------------------------------------------------
    solver = SimplexSolver(
        c=objective_coeffs,
        A=constraints_matrix,
        b=rhs_values,
        constraint_types=constraint_types,
        objective='max',
        variable_names=variable_names,
    )

    result = solver.solve(verbose=True)

    # ------------------------------------------------------------------
    # Output Parsing
    # ------------------------------------------------------------------
    print('\n' + '-' * 55)
    print(' PROGRAMMATIC ACCESS TO RESULTS')
    print('-' * 55)
    print(f" Status            : {result['status']}")
    print(f" Optimal Solution  : {dict(zip(result['variable_names'], result['solution']))}")
    print(f" Optimal Value (z) : {result['optimal_value']}")
    print(f" Multiple Solutions: {result['has_multiple_solutions']}")

    if result['has_multiple_solutions']:
        print(f" Alternative Vars  : {result['multiple_solution_vars']}")
        for idx, alt in enumerate(result['alternative_solutions'], 1):
            vals = dict(zip(result['variable_names'], alt))
            print(f" Alt Solution {idx}  : {vals}")
    print('-' * 55)


if __name__ == '__main__':
    main()