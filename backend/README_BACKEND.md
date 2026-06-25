# Operações de Backend — JPAD Simplex

Este documento descreve a arquitetura técnica do back-end de resolução de Programação Linear. O projeto foi organizado em módulos coesos, cada um com uma responsabilidade clara, e expostos ao front-end por uma fina camada HTTP em Flask.

---

## 🗂️ Visão geral dos módulos

| Arquivo | Responsabilidade |
| --- | --- |
| **`simplex.py`** | Motor de resolução do Simplex em forma tabular, com Big-M. Núcleo matemático do projeto. |
| **`dual.py`** | Construção e resolução do problema dual (reaproveita o `SimplexSolver`). |
| **`branch_and_bound.py`** | Algoritmo de Branch & Bound para solução inteira (também reaproveita o `SimplexSolver`). |
| **`api.py`** | Camada Flask: traduz JSON do front-end ⇄ inputs do solver e expõe `/solve` e `/health`. |
| **`radiotherapy_example.py`** | Script de validação com o problema clássico da radioterapia. |
| **`graficos.py`** | Visualização local com matplotlib — ferramenta de desenvolvimento. |
| **`teste_grafico.py`** | Script de teste que combina o solver com `graficos.py` para inspeção no terminal. |

A regra de design é simples: **`simplex.py` é o núcleo e não conhece a API**. Os módulos `dual.py` e `branch_and_bound.py` apenas o importam. A `api.py` orquestra todos eles.

---

## 🧮 Motor Simplex (`simplex.py`)

A classe `SimplexSolver` recebe um Problema de Programação Linear genérico e o resolve pela forma tabular.

### Características

* **Maximização e minimização** suportados nativamente.
* **Três tipos de restrição:** `<=`, `>=`, `=`.
* **Método Big-M** (`BIG_M = 1_000_000`) para penalizar variáveis artificiais.
* **Tolerância numérica** `EPS = 1e-9` para evitar erros de ponto flutuante na regra de parada.

### Fluxo

1. **Forma padrão.** Variáveis de folga para `<=`, excesso + artificial para `>=`, artificial isolada para `=`. Lados direitos negativos são normalizados antes.
2. **Iteração.**
   * **Entrada:** variável não-básica com coeficiente mais negativo na linha objetivo.
   * **Saída:** teste da razão mínima (detecta ilimitação quando todas as razões são inválidas).
   * **Pivotamento:** operações elementares por linha sobre o tableau (NumPy).
3. **Detecção de soluções múltiplas.** Após a otimização, varre as variáveis não-básicas originais com custo reduzido `0`. Quando encontradas, simula pivotamentos adicionais para extrair as soluções alternativas.
4. **Diagnóstico.** Devolve `status ∈ {optimal, infeasible, unbounded}` e, no caso ótimo, a solução, o valor de `Z*` e o tableau final.

---

## 🔁 Problema Dual (`dual.py`)

Constrói e resolve o **dual** do primal, reaproveitando o próprio `SimplexSolver`. É um dos itens de bonificação implementados (**+3 pts**).

### Casos tratados

* **Simétrico (sem padronização):**
  * `max + todas <=` ⇒ dual `min + todas >=`
  * `min + todas >=` ⇒ dual `max + todas <=`
* **Geral (com padronização):**
  * Restrições `>=` multiplicadas por −1 viram `<=`.
  * Restrições `=` são divididas em duas restrições `<=`.
  * Se o objetivo do primal é `min`, o sinal de `Z*` é restaurado no final.

### Verificação automática

Pela **dualidade forte**, vale sempre `Z* dual = Z* primal`. A API e o front-end usam essa identidade como verificação automática, sinalizando-a no painel da aba "Tableau Dual" com um selo "= Z\* primal ✓".

### API pública

```python
from dual import solve_dual
solver, result, dual_problem = solve_dual(c, A, b, constraint_types, objective)
```

`dual_problem` traz, além do problema dual resolvido, dois metadados úteis para a interface:
* `standardized` — se houve padronização (mostrado como aviso ao usuário).
* `var_origin` — de qual restrição primal cada variável dual veio.

---

## 🧩 Solução Inteira via Branch & Bound (`branch_and_bound.py`)

Resolve problemas de Programação Linear Inteira pelo algoritmo de B&B clássico. Outro item de bonificação implementado (**+4 pts**).

### Estratégia

* **Busca best-first** (heap de prioridade por `Z` relaxado).
* **Variável de ramificação:** a com **maior parte fracionária**.
* **Podas:**
  * **Inviabilidade:** LP do nó não tem solução ótima.
  * **Limite (bound):** `Z` do nó não pode melhorar o melhor incumbente.
* **Limite de nós:** 200 (proteção contra explosão combinatória; ajustável).
* **Tolerância de integralidade:** `tol = 1e-6`.

### Saída

```python
{
    'status': 'optimal' | 'infeasible' | 'unbounded' | 'node_limit',
    'solution': [...],             # vetor inteiro
    'optimal_value': Z*,
    'final_solver': SimplexSolver,  # do nó vencedor (para o tableau final)
    'final_result': dict,
    'log': {
        'nodes_explored': int,
        'pruned_by_bound': int,
        'pruned_by_infeasibility': int,
        'max_depth': int,
        'incumbent_history': [...]  # histórico de incumbentes
    }
}
```

Quando a relaxação LP já é inteira, o algoritmo retorna direto sem ramificar (1 nó explorado).

### API pública

```python
from branch_and_bound import solve_integer
result = solve_integer(c, A, b, constraint_types, objective,
                       variable_names=None, max_nodes=200, tol=1e-6)
```

---

## 🌐 Camada de API (`api.py`)

O motor é exposto ao front-end via Flask, **sem modificar o `simplex.py`**. A API apenas importa os módulos.

### Endpoints

| Método | Rota | Função |
| --- | --- | --- |
| `GET`  | `/health` | Verificação de que a API está no ar. |
| `POST` | `/solve`  | Resolve o problema (primal sempre; dual e inteiro condicionalmente). |

### Comportamento condicional

O corpo da requisição inclui os booleanos `calcDual` e `seekInteger`:

* Se `calcDual: true` → a API também resolve o dual e adiciona `dualResult` à resposta.
* Se `seekInteger: true` → a API também executa o B&B e adiciona `integerResult` à resposta.
* **Inviabilidade** e **ilimitação** do primal retornam `200 OK` com `status` correspondente — o front-end converte em mensagens claras.

A **geometria do gráfico 2D** (vértices, ponto ótimo, eixos) **não** é calculada aqui — fica no cliente, pois é uma questão puramente de visualização.

> Documentação completa dos schemas, códigos de erro e funções internas em [`../API.md`](../API.md).

---

## 📊 Caso de uso de referência (`radiotherapy_example.py`)

Script standalone que valida o motor com o problema clássico da radioterapia:

* **Objetivo:** maximizar a dose no tumor `z = 0.4x₁ + 0.5x₂`
* **Restrições de tecidos saudáveis:**
  * `0.3x₁ + 0.1x₂ ≤ 2.7`
  * `0.5x₁ + 0.5x₂ ≤ 6.0`
  * `0.6x₁ + 0.4x₂ ≤ 6.0`

Resolve com `verbose=True`, exibindo cada iteração do tableau no terminal, e devolve um dicionário com a solução. Resultado: **Z\* = 6.0** em `(x₁, x₂) = (0, 12)`.

---

## 🖥️ Validação visual no terminal (`graficos.py` e `teste_grafico.py`)

Ferramentas de **desenvolvimento e depuração local** que permitem ver o resultado do solver sem precisar subir a interface web.

* **`graficos.py`** — Plota com matplotlib as retas das restrições, a região viável sombreada, a curva de nível da função objetivo e o ponto ótimo. Salva como `grafico_simplex.png` e abre uma janela local.
* **`teste_grafico.py`** — Resolve `max 3x₁ + 5x₂` com `verbose=True` e chama `graficos.py` ao final.

```bash
cd backend
pip install matplotlib
python teste_grafico.py
```

> Esses scripts **não** fazem parte da API nem são chamados pelo front-end. O gráfico interativo da interface é gerado nativamente em SVG pelo próprio React, a partir dos dados retornados pela API.
>>>>>>> main

---

## ⚙️ Dependências

* **Python 3.10+**
* **NumPy** — operações de matriz no Simplex
* **Flask** + **Flask-CORS** — servidor HTTP e CORS para o front-end Vite
* **matplotlib** (opcional) — somente para os scripts de visualização local

As três primeiras estão em `requirements.txt`:

```bash
pip install -r requirements.txt
```

`matplotlib` deve ser instalado à parte caso você queira usar os scripts de validação no terminal.

---

## 🚀 Como executar

```bash
cd backend
pip install -r requirements.txt
python api.py
```

A API sobe em `http://localhost:5000`. Confirme com:

```bash
curl http://localhost:5000/health
# {"service":"jpad-simplex-api","status":"ok"}
```
