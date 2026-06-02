# Operações de Backend: Simplex Solver

Este documento descreve a arquitetura técnica e a implementação matemática do motor de resolução de Programação Linear desenvolvido para este projeto de Pesquisa Operacional. O backend foi projetado priorizando eficiência, modularidade e clareza no processo de pivotamento.

---

## 🛠 Arquitetura do Módulo (`simplex.py`)

A classe principal `SimplexSolver` foi desenhada para receber instâncias genéricas de Problemas de Programação Linear (PPL) e processá-las utilizando a forma tabular do algoritmo Simplex. Todo o código base e documentação interna está em inglês, seguindo os padrões de desenvolvimento de software.

### Fluxo de Processamento

1. **Ingestão e Parsing de Dados:**
   - O solver aceita matrizes de restrições (`A`), coeficientes da função objetivo (`c`) e termos independentes (`b`).
   - Suporta nativamente problemas de **Maximização** e **Minimização**.
   - Aceita restrições flexíveis: `<=`, `>=` e `=`.

2. **Conversão para a Forma Padrão (Standard Form):**
   - **Variáveis de Folga (Slack):** Injetadas automaticamente para restrições `<=`.
   - **Variáveis de Excesso (Surplus) e Artificiais:** Aplicadas para restrições `>=`.
   - **Variáveis Artificiais:** Aplicadas de forma isolada para restrições de igualdade `=`.
   - Implementação do **Método Big-M** (`BIG_M = 1_000_000`) para penalizar variáveis artificiais na função objetivo durante as iterações iniciais, forçando-as a saírem da base.

3. **Ciclo de Iteração (Pivotamento):**
   - **Regra de Entrada:** Seleciona a variável não-básica com o coeficiente mais negativo na linha objetivo (com base no critério de parada utilizando tolerância numérica `EPS = 1e-9` para evitar erros de ponto flutuante).
   - **Regra de Saída (Teste da Razão Mínima):** Impede a divisão por zero e detecta problemas ilimitados mapeando divisões inválidas como infinito.
   - **Atualização do Tableau:** Executa operações elementares por linha usando a eficiência matemática nativa da biblioteca `numpy`.

4. **Detecção de Soluções Múltiplas:**
   - O sistema realiza varredura pós-otimização para identificar variáveis originais não-básicas com custo reduzido exato de `0`. Se detectado, o solver simula pivotamentos adicionais em *background* para entregar as soluções alternativas nos resultados.

---

## 📊 Caso de Uso Implementado (`radiotherapy_example.py`)

Como prova de conceito da infraestrutura matemática, o repositório acompanha um script focado no clássico problema da modelagem radioterápica.

* **Objetivo Matemático:** Maximizar a incidência de dose (`z = 0.4x1 + 0.5x2`) diretamente no tumor.
* **Limites Operacionais:** * Tecido saudável A: `0.3x1 + 0.1x2 <= 2.7`
    * Tecido saudável B: `0.5x1 + 0.5x2 <= 6.0`
    * Tecido saudável C: `0.6x1 + 0.4x2 <= 6.0`

O script invoca a classe, realiza a resolução com o modo verboso habilitado (`verbose=True`), exibindo a evolução real de cada iteração do *Tableau* no terminal, e encerra devolvendo um dicionário com fácil acesso programático aos resultados processados.

---

## ⚙️ Dependências

* **Python 3.x**
* **NumPy:** Utilizado intensamente para manipulação de arrays `float64`, garantindo maior performance nas operações de pivotamento matricial.