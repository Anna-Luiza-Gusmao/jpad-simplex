import numpy as np
import matplotlib.pyplot as plt


def plotar_regiao_viavel(c, A, b, solucao=None):

    if len(c) != 2:
        raise ValueError(
            "A visualização gráfica funciona apenas para problemas com 2 variáveis."
        )

    x = np.linspace(0, 20, 1000)

    plt.figure(figsize=(10, 6))

    y_limites = []

    for i, restricao in enumerate(A):

        a1 = restricao[0]
        a2 = restricao[1]

        if abs(a2) > 0:

            y = (b[i] - a1 * x) / a2

            plt.plot(
                x,
                y,
                label=f"Restrição {i+1}"
            )

            y_limites.append(y)

        else:

            x_vertical = b[i] / a1

            plt.axvline(
                x=x_vertical,
                label=f"Restrição {i+1}"
            )

    if y_limites:

        y_viavel = np.minimum.reduce(y_limites)

        y_viavel = np.maximum(y_viavel, 0)

        plt.fill_between(
            x,
            0,
            y_viavel,
            alpha=0.3,
            label="Região Viável"
        )

    if solucao is not None:

        x_otimo = solucao[0]
        y_otimo = solucao[1]

        plt.scatter(
            x_otimo,
            y_otimo,
            s=100,
            label="Solução Ótima"
        )

        z = c[0] * x_otimo + c[1] * y_otimo

        if abs(c[1]) > 0:
            y_nivel = (z - c[0] * x) / c[1]

            plt.plot(
                x,
                y_nivel,
                "--",
                label="Curva de Nível"
            )

    plt.xlim(left=0)
    plt.ylim(bottom=0)

    plt.xlabel("x1")
    plt.ylabel("x2")

    plt.title("Região de Viabilidade e Ponto Ótimo")

    plt.grid(True)
    plt.legend()
    plt.tight_layout()

    plt.savefig("grafico_simplex.png", dpi=300, bbox_inches="tight")
    plt.show()