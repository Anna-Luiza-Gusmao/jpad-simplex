from simplex import SimplexSolver
from graficos import plotar_regiao_viavel


c = [3, 5]

A = [
    [1, 0],
    [3, 2]
]

b = [
    4,
    18
]

constraint_types = ["<=", "<="]

solver = SimplexSolver(
    c=c,
    A=A,
    b=b,
    constraint_types=constraint_types,
    objective="max",
    variable_names=["x1", "x2"]
)

resultado = solver.solve(verbose=True)

print(resultado)

if resultado["status"] == "optimal":
    plotar_regiao_viavel(
        c=c,
        A=A,
        b=b,
        solucao=resultado["solution"]
    )
else:
    print("Não foi possível gerar gráfico, pois o problema não teve solução ótima.")