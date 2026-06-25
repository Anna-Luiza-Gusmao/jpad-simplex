# 📝 Registro de Alterações — JPAD Simplex

Este documento registra cronologicamente todas as alterações realizadas no projeto após a entrega inicial do front-end, cobrindo a integração back-end ↔ front-end, a correção de um bug pré-existente no solver e a implementação de todas as funcionalidades obrigatórias e de bonificação.

O princípio que guiou cada etapa foi **alterar apenas o necessário**: a interface, os tipos e o algoritmo já existentes foram preservados ao máximo em cada intervenção.

---

## Etapa 1 — Integração back-end ↔ front-end

### Contexto

O front-end resolvia os problemas com um solver aproximado em JavaScript (`mockSolve`) e não se comunicava com o algoritmo Simplex real em Python.

### Arquivos criados

| Arquivo | Descrição |
| --- | --- |
| `backend/api.py` | Servidor Flask com os endpoints `GET /health` e `POST /solve`. |
| `backend/requirements.txt` | Dependências do back-end: Flask, Flask-CORS, NumPy. |
| `frontend/src/app/utils/api.ts` | Função `solveProblem` que envia o problema à API e monta o `SimplexResult`. |

### Arquivos editados

| Arquivo | Mudança |
| --- | --- |
| `frontend/src/app/utils/solver.ts` | Adicionada `computeGeometry` (calcula vértices, ponto ótimo e eixos para o gráfico). `mockSolve` preservado intacto. |
| `frontend/src/app/pages/InputPage.tsx` | Import trocado de `mockSolve` para `solveProblem`; `handleSolve` tornou-se assíncrona; adicionado estado `loading` com botão desabilitado durante o cálculo. |

### Arquivos preservados sem alteração

`types.ts`, `ResultsPage.tsx`, `FeasibilityChart.tsx` — possível porque `solveProblem` devolve exatamente o mesmo formato `SimplexResult` que `mockSolve` devolvia.

---

## Etapa 1.1 — Correção de bug no `simplex.py` (Big-M)

### Sintoma

Para problemas que misturavam restrições `>=` ou `=` com `<=`, o solver retornava resultados incorretos ou mascarava inviabilidade. Problemas apenas com `<=` (incluindo a radioterapia) nunca foram afetados.

### Causa raiz

Em `_build_standard_form`, a lista `self.basis` era montada agrupada por tipo de variável com `.append()`. Isso desalinhava a base das linhas do tableau quando as restrições eram de tipos mistos.

### Correção (4 linhas em `simplex.py`)

```python
# Antes
self.basis = []
self.basis.append(col)      # agrupava por tipo → desalinhava linhas

# Depois
self.basis = [-1] * m
self.basis[i] = col         # atribui pela linha i da restrição
```

### Validação

| Cenário | Antes | Depois |
| --- | --- | --- |
| Radioterapia (só `<=`) | ✅ correto | ✅ correto |
| Big-M com `>=` e `=` | ❌ solução inválida | ✅ Z=24, x=(6,4) |
| Inviável | ❌ mascarado | ✅ detectado |

---

## Etapa 2 — Múltiplas soluções na interface (obrigatório)

### Contexto

O solver já detectava soluções múltiplas e a API já enviava `hasMultipleSolutions` e `multipleSolutionVars`, mas a `ResultsPage` ignorava esses campos.

### Arquivos editados

| Arquivo | Mudança |
| --- | --- |
| `backend/api.py` | `build_response` passou a incluir `alternativeSolutions` (cada solução alternativa no formato `VarValue[]`). |
| `frontend/src/app/types.ts` | Adicionados campos opcionais `hasMultipleSolutions?`, `multipleSolutionVars?` e `alternativeSolutions?` ao `SimplexResult`. |
| `frontend/src/app/utils/api.ts` | Repasse dos novos campos do backend para o resultado. |
| `frontend/src/app/pages/ResultsPage.tsx` | Bloco visual em âmbar (ícone Sparkles) exibido entre os cartões de métrica e o painel de abas, mostrando cada solução alternativa em chips. Visível apenas quando `hasMultipleSolutions && alternativeSolutions.length > 0`. |

---

## Etapa 3 — Solução Dual tabular (bônus +3 pts)

### Arquivos criados

| Arquivo | Descrição |
| --- | --- |
| `backend/dual.py` | Módulo `build_dual_problem` + `solve_dual`: constrói e resolve o dual reaproveitando o `SimplexSolver`. Trata casos simétricos (sem padronização) e gerais (restrições mistas). |

### Arquivos editados

| Arquivo | Mudança |
| --- | --- |
| `backend/api.py` | Import de `solve_dual`; nova função `build_dual_response`; chamada condicional quando `calcDual: true`. |
| `frontend/src/app/types.ts` | Novas interfaces `DualFormulation` e `DualResult`; campo `dualResult?` em `SimplexResult`. |
| `frontend/src/app/utils/api.ts` | Import de `DualResult`; repasse de `dualResult`. |
| `frontend/src/app/pages/ResultsPage.tsx` | `DualTab` reescrita com formulação em notação matemática, cartão Z\* com selo "= Z\* primal ✓", chips com y\* e tableau completo. `renderHeader`/`renderBase` atualizados para suportar `y` e `e`. |

### Propriedade verificada

Dualidade forte validada em todos os casos: Z\*\_dual = Z\*\_primal (inclusive casos com padronização de restrições mistas).

---

## Etapa 4 — Solução Inteira tabular via Branch & Bound (bônus +4 pts)

### Arquivos criados

| Arquivo | Descrição |
| --- | --- |
| `backend/branch_and_bound.py` | Algoritmo B&B com busca best-first, escolha da variável de maior fração, podas por inviabilidade e por limite, limite de 200 nós e tolerância `1e-6`. |

### Arquivos editados

| Arquivo | Mudança |
| --- | --- |
| `backend/api.py` | Import de `solve_integer`; nova função `build_integer_response`; chamada condicional quando `seekInteger: true`. |
| `frontend/src/app/types.ts` | Novas interfaces `IntegerIncumbent`, `IntegerLog` e `IntegerResult`; campo `integerResult?` em `SimplexResult`. |
| `frontend/src/app/utils/api.ts` | Import de `IntegerResult`; repasse de `integerResult`. |
| `frontend/src/app/pages/ResultsPage.tsx` | `InteiraTab` reescrita com cartão Z\* inteiro (tema roxo), gap percentual em relação ao contínuo, chips de variáveis, tableau do nó vencedor e log de exploração (4 métricas + histórico de incumbentes). |

### Validação

| Caso | Z relaxado | Z inteiro | Status |
| --- | --- | --- | --- |
| Radioterapia | 6,0 (já inteiro) | 6,0 | 1 nó |
| max 5x₁+4x₂ | 21,0 | 20,0 | 5 nós |
| max 3x₁+5x₂ | 45,0 (já inteiro) | 45,0 | 1 nó |
| Inviável inteiro | — | — | `infeasible` |

---

## Etapa 5 — Solução Inteira gráfica (bônus +3 pts)

### Arquivos editados

| Arquivo | Mudança |
| --- | --- |
| `frontend/src/app/utils/solver.ts` | Nova função `computeIntegerPoints`: enumera todos os pontos `(x₁, x₂)` inteiros viáveis dentro dos bounds do gráfico. Safeguard: retorna `[]` quando a grade ultrapassa ~1100 candidatos. |
| `frontend/src/app/types.ts` | Campos `integerFeasiblePoints?` e `integerOptimalPoint?` em `SimplexResult`. |
| `frontend/src/app/utils/api.ts` | Import de `computeIntegerPoints`; cálculo dos campos condicionado à existência de solução inteira ótima com 2 variáveis. |
| `frontend/src/app/components/FeasibilityChart.tsx` | Duas novas camadas SVG: pontos inteiros viáveis (violet-400, r=3) e ponto ótimo inteiro (violet-600, r=5.5 com borda branca). Renderizadas apenas quando os campos estão presentes. |
| `frontend/src/app/pages/ResultsPage.tsx` | Legendas condicionais "Pontos inteiros viáveis" e "Solução inteira ótima" adicionadas ao painel `GraficaTab`. |

### Comportamento visual

Quando `seekInteger: true` e o problema tem 2 variáveis:
- Pontos inteiros viáveis aparecem em roxo-claro dentro da região.
- O ótimo inteiro (roxo-escuro) coexiste com o ótimo contínuo (âmbar).
- Quando coincidem, o roxo fica por cima (borda branca garante distinção).
- Quando divergem, o contraste evidencia visualmente a diferença entre PL contínua e PL inteira.

---

## Resumo consolidado de todos os arquivos

### Criados

| Arquivo | Etapa |
| --- | --- |
| `backend/api.py` | 1 |
| `backend/requirements.txt` | 1 |
| `backend/dual.py` | 3 |
| `backend/branch_and_bound.py` | 4 |
| `frontend/src/app/utils/api.ts` | 1 |

### Editados

| Arquivo | Etapas |
| --- | --- |
| `backend/simplex.py` | 1.1 (bug fix) |
| `backend/api.py` | 2, 3, 4 |
| `frontend/src/app/types.ts` | 2, 3, 4, 5 |
| `frontend/src/app/utils/api.ts` | 2, 3, 4, 5 |
| `frontend/src/app/utils/solver.ts` | 1, 5 |
| `frontend/src/app/pages/InputPage.tsx` | 1 |
| `frontend/src/app/pages/ResultsPage.tsx` | 2, 3, 4, 5 |
| `frontend/src/app/components/FeasibilityChart.tsx` | 5 |

### Preservados sem alteração

`frontend/src/app/pages/ResultsPage.tsx` (estrutura de abas e cartões), `frontend/src/app/types.ts` (interfaces base como `VarValue`, `TableauRow`, `SimplexProblem`).
