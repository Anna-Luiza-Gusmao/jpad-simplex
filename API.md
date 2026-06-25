# 🌐 Documentação da API — JPAD Simplex

Este documento descreve a camada HTTP que conecta o back-end Python ao front-end React: arquitetura, fluxo de dados, todos os endpoints e as funções internas da `api.py`.

---

## 1. Arquitetura e divisão de responsabilidades

```
┌────────────────────────────┐     HTTP / JSON      ┌──────────────────────────────┐
│         FRONT-END          │  ──────────────────► │          BACK-END            │
│   React + Vite  (:5173)    │    POST /solve        │      Flask API  (:5000)      │
│                            │  ◄────────────────── │                              │
│  InputPage  →  api.ts      │    resposta JSON      │  api.py → simplex.py         │
│  ResultsPage               │                      │           dual.py            │
│  FeasibilityChart          │                      │           branch_and_bound.py│
└────────────────────────────┘                      └──────────────────────────────┘
```

| Camada | Responsabilidade |
| --- | --- |
| **Back-end** | Toda a matemática: Simplex tabular (Big-M), problema dual, Branch & Bound para solução inteira, tableau final, múltiplas soluções, inviabilidade e ilimitação. |
| **Front-end** | Geometria do gráfico 2D (vértices da região viável, eixos, limites) e enumeração dos pontos inteiros viáveis para o overlay gráfico. |

---

## 2. Fluxo de dados

1. O usuário preenche o problema em `InputPage.tsx` e clica **Resolver**.
2. `solveProblem` (`api.ts`) envia `POST /solve` com o `SimplexProblem` em JSON.
3. A API executa:
   - **Sempre:** `SimplexSolver` (Simplex primal real).
   - **Se `calcDual: true`:** `solve_dual` (problema dual via `dual.py`).
   - **Se `seekInteger: true`:** `solve_integer` (Branch & Bound via `branch_and_bound.py`).
4. A resposta JSON retorna com o resultado primal e, opcionalmente, `dualResult` e `integerResult`.
5. `solveProblem` calcula localmente `computeGeometry` e, quando há solução inteira, `computeIntegerPoints`.
6. O `SimplexResult` completo é entregue à `ResultsPage`, que distribui os dados pelas quatro abas.

---

## 3. Tecnologias

| Item | Detalhe |
| --- | --- |
| Framework HTTP | [Flask](https://flask.palletsprojects.com/) |
| CORS | [Flask-CORS](https://flask-cors.readthedocs.io/) — libera `localhost:5173` em desenvolvimento |
| Cálculo matricial | [NumPy](https://numpy.org/) |
| Porta padrão | `5000` |

---

## 4. Endpoints

### 4.1 `GET /health`

Verificação de que a API está no ar.

**Resposta `200 OK`:**
```json
{ "status": "ok", "service": "jpad-simplex-api" }
```

---

### 4.2 `POST /solve`

Resolve um problema de Programação Linear. Retorna sempre o resultado primal e, condicionalmente, o dual e/ou a solução inteira.

#### Corpo da requisição

```json
{
  "objectiveType": "maximize",
  "numVars": 2,
  "objCoeffs": ["0.4", "0.5"],
  "constraints": [
    { "coefficients": ["0.3", "0.1"], "op": "<=", "rhs": "2.7" },
    { "coefficients": ["0.5", "0.5"], "op": "<=", "rhs": "6.0" },
    { "coefficients": ["0.6", "0.4"], "op": "<=", "rhs": "6.0" }
  ],
  "seekInteger": false,
  "calcDual": false
}
```

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `objectiveType` | `"maximize"` \| `"minimize"` | Sentido da otimização. |
| `numVars` | inteiro | Número de variáveis de decisão. |
| `objCoeffs` | `string[]` | Coeficientes da função objetivo. |
| `constraints[].coefficients` | `string[]` | Coeficientes da restrição. |
| `constraints[].op` | `"<="` \| `">="` \| `"="` | Tipo da restrição. |
| `constraints[].rhs` | `string` | Lado direito da restrição. |
| `calcDual` | `bool` | Se `true`, resolve e retorna o problema dual. |
| `seekInteger` | `bool` | Se `true`, executa B&B e retorna a solução inteira. |

> Os coeficientes chegam como **strings** porque vêm de campos de formulário. A API converte via `_to_float`.

#### Resposta `200 OK` — resultado primal (sempre presente)

```json
{
  "status": "optimal",
  "isOptimal": true,
  "optimalZ": 6.0,
  "varValues": [
    { "name": "x", "index": 1, "value": 0.0 },
    { "name": "x", "index": 2, "value": 12.0 }
  ],
  "isInteger": true,
  "hasDual": true,
  "tableHeaders": ["Base", "x1", "x2", "F1", "F2", "F3", "b"],
  "tableRows": [
    { "base": "F1", "values": [0.2,  0.0, 1.0, -0.2, 0.0,  1.5] },
    { "base": "x2", "values": [1.0,  1.0, 0.0,  2.0, 0.0, 12.0] },
    { "base": "F3", "values": [0.2,  0.0, 0.0, -0.8, 1.0,  1.2] },
    { "base": "Z",  "values": [0.1,  0.0, 0.0,  1.0, 0.0,  6.0] }
  ],
  "hasMultipleSolutions": false,
  "multipleSolutionVars": [],
  "alternativeSolutions": []
}
```

| Campo | Descrição |
| --- | --- |
| `status` | `"optimal"` \| `"infeasible"` \| `"unbounded"` |
| `optimalZ` | Valor ótimo de Z. |
| `varValues` | Valores das variáveis de decisão na solução primal. |
| `isInteger` | `true` se todos os valores da solução primal já são inteiros. |
| `hasDual` | `true` quando nº restrições ≥ nº variáveis (habilita aba Dual na UI). |
| `tableHeaders` | Cabeçalhos do quadro ótimo: `Base`, variáveis de decisão, folgas, `b`. |
| `tableRows` | Linhas do quadro; a linha `Z` é sempre a última. |
| `hasMultipleSolutions` | `true` quando há soluções alternativas com o mesmo Z*. |
| `multipleSolutionVars` | Nomes das variáveis não-básicas com custo reduzido zero. |
| `alternativeSolutions` | Lista de `VarValue[]`, uma por solução alternativa encontrada. |

#### Sub-objeto `dualResult` (presente quando `calcDual: true` e primal ótimo)

```json
{
  "status": "optimal",
  "isOptimal": true,
  "optimalZ": 6.0,
  "varValues": [
    { "name": "y", "index": 1, "value": 0.0 },
    { "name": "y", "index": 2, "value": 1.0 },
    { "name": "y", "index": 3, "value": 0.0 }
  ],
  "tableHeaders": ["Base", "y1", "y2", "y3", "F1", "F2", "b"],
  "tableRows": ["..."],
  "formulation": {
    "objectiveType": "minimize",
    "objCoeffs": [2.7, 6.0, 6.0],
    "constraints": [
      { "coefficients": [0.3, 0.5, 0.6], "op": ">=", "rhs": 0.4 },
      { "coefficients": [0.1, 0.5, 0.4], "op": ">=", "rhs": 0.5 }
    ]
  },
  "standardized": false
}
```

| Campo | Descrição |
| --- | --- |
| `optimalZ` | Z* do dual — sempre igual ao Z* primal pela dualidade forte. |
| `varValues` | Variáveis duais `y₁, y₂, …` (preços-sombra das restrições). |
| `formulation` | Formulação completa do dual exibida na aba Dual da interface. |
| `standardized` | `true` se o primal tinha restrições mistas e precisou ser padronizado antes da dualização. |

#### Sub-objeto `integerResult` (presente quando `seekInteger: true` e primal ótimo)

```json
{
  "status": "optimal",
  "isOptimal": true,
  "optimalZ": 6.0,
  "varValues": [
    { "name": "x", "index": 1, "value": 0 },
    { "name": "x", "index": 2, "value": 12 }
  ],
  "tableHeaders": ["Base", "x1", "x2", "F1", "F2", "F3", "b"],
  "tableRows": ["..."],
  "log": {
    "nodesExplored": 1,
    "prunedByBound": 0,
    "prunedByInfeasibility": 0,
    "maxDepth": 0,
    "incumbentHistory": [
      { "nodeId": 1, "depth": 0, "z": 6.0, "solution": [0, 12] }
    ]
  }
}
```

| Campo | Descrição |
| --- | --- |
| `status` | `"optimal"` \| `"infeasible"` \| `"unbounded"` \| `"node_limit"` |
| `optimalZ` | Z* inteiro (sempre ≤ Z* contínuo para maximização). |
| `varValues` | Valores **inteiros** das variáveis na solução ótima. |
| `tableHeaders` / `tableRows` | Tableau do nó vencedor, mesmo formato do primal. |
| `log.nodesExplored` | Total de nós processados na árvore B&B. |
| `log.prunedByBound` | Ramos descartados por não poderem melhorar o incumbente. |
| `log.prunedByInfeasibility` | Ramos descartados por inviabilidade do LP. |
| `log.maxDepth` | Profundidade máxima atingida na árvore. |
| `log.incumbentHistory` | Cada entrada registra um nó onde uma solução inteira melhor foi encontrada. |
| `message` | Presente quando `status !== "optimal"` com explicação em português. |

#### Respostas de erro HTTP

| Código | Situação |
| --- | --- |
| `400 Bad Request` | JSON ausente, inválido ou sem variáveis/restrições. |
| `500 Internal Server Error` | Falha inesperada durante a resolução. |

> `infeasible` e `unbounded` retornam `200 OK` com o campo `status` correspondente. O front-end converte em mensagens claras para o usuário.

---

## 5. Funções internas do `api.py`

| Função | Papel |
| --- | --- |
| `_to_float(value, default)` | Converte strings/números do formulário com segurança. |
| `_snap(value)` | Arredonda e colapsa resíduos de ponto flutuante `< 1e-7` para zero. |
| `_display_name(name)` | `s1 → F1` (Folga); demais nomes inalterados. |
| `parse_problem(payload)` | Traduz o JSON do front-end para os argumentos do `SimplexSolver`. |
| `build_tableau_view(solver)` | Monta `tableHeaders` e `tableRows` a partir do tableau real; omite variáveis artificiais. |
| `build_response(...)` | Monta o payload primal completo (inclui `alternativeSolutions`). |
| `build_dual_response(...)` | Monta o sub-objeto `dualResult` com formulação e tableau do dual. |
| `build_integer_response(...)` | Monta o sub-objeto `integerResult` com tableau do nó vencedor e log do B&B. |

### Regras do tableau exibido

- Variáveis **artificiais** (Big-M) são **omitidas** — padrão para o quadro ótimo.
- Folga interna `s1` → exibida como `F1`; excesso `e1` mantém o nome.
- A linha `Z` é sempre a **última**; seu `b` traz o Z* já corrigido.
- Cada `row.values` tem exatamente `len(tableHeaders) - 1` elementos (`Base` fica em `row.base`).

---

## 6. Variável de ambiente

| Variável | Onde | Efeito |
| --- | --- | --- |
| `VITE_API_URL` | `.env` em `frontend/` | Sobrescreve `http://localhost:5000` — útil em produção. |

---

## 7. Como executar

```bash
# Back-end
cd backend
pip install -r requirements.txt
python api.py          # API em http://localhost:5000

# Front-end (outro terminal)
cd frontend
npm install
npm run dev            # Interface em http://localhost:5173
```
