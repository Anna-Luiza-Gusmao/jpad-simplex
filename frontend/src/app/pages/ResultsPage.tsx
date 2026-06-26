import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  ArrowLeft,
  Target,
  TrendingUp,
  Grid3X3,
  Activity,
  CircleDot,
  LayoutGrid,
  Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from '../components/Logo';
import { FeasibilityChart } from '../components/FeasibilityChart';
import { SimplexProblem, SimplexResult } from '../types';

type TabId = 'primal' | 'grafica' | 'dual' | 'inteira';

interface TabDef {
  id: TabId;
  label: string;
  sublabel?: string;
  icon: ReactNode;
}

const TABS: TabDef[] = [
  { id: 'primal', label: 'Tableau Simplex', sublabel: '(Primal)', icon: <Grid3X3 size={15} /> },
  { id: 'grafica', label: 'Solução Gráfica', sublabel: '(2D)', icon: <Activity size={15} /> },
  { id: 'dual', label: 'Tableau Dual', sublabel: '(Bônus)', icon: <LayoutGrid size={15} /> },
  { id: 'inteira', label: 'Solução Inteira', sublabel: '(Bônus)', icon: <CircleDot size={15} /> },
];

function formatNum(n: number): string {
  if (Number.isInteger(n)) return n.toFixed(2);
  const s = n.toFixed(4).replace(/0+$/, '');
  return s.endsWith('.') ? s + '00' : s.length - s.indexOf('.') - 1 > 2 ? n.toFixed(4) : n.toFixed(2);
}

function renderHeader(h: string): ReactNode {
  if (h === 'Base') return 'Base';
  if (h === 'b') return <span className="font-semibold">b</span>;
  if (h.startsWith('x')) return <><em>x</em><sub>{h.slice(1)}</sub></>;
  if (h.startsWith('y')) return <><em>y</em><sub>{h.slice(1)}</sub></>;
  if (h.startsWith('F')) return <><em>F</em><sub>{h.slice(1)}</sub></>;
  if (h.startsWith('e')) return <><em>e</em><sub>{h.slice(1)}</sub></>;
  return h;
}

function renderBase(b: string): ReactNode {
  if (b === 'Z') return <em className="not-italic font-bold text-green-700">Z</em>;
  if (b.startsWith('x')) return <><em>x</em><sub>{b.slice(1)}</sub></>;
  if (b.startsWith('y')) return <><em>y</em><sub>{b.slice(1)}</sub></>;
  if (b.startsWith('F')) return <><em>F</em><sub>{b.slice(1)}</sub></>;
  if (b.startsWith('e')) return <><em>e</em><sub>{b.slice(1)}</sub></>;
  return b;
}

// ── Primal Tab ──────────────────────────────────────────────
function PrimalTab({ result }: { result: SimplexResult }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-slate-700" style={{ fontSize: '1.05rem', fontWeight: 500 }}>
          Última Iteração (Quadro Ótimo)
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {result.tableHeaders.map((h, i) => {
                const isRhs = h === 'b';
                const isBase = h === 'Base';
                return (
                  <th
                    key={i}
                    className={`px-5 py-3 text-sm font-semibold text-center ${
                      isBase ? 'text-left pl-6 text-slate-600' :
                      isRhs ? 'text-slate-700 bg-slate-100' :
                      h.startsWith('F') ? 'text-slate-500' :
                      'text-slate-700'
                    }`}
                  >
                    {renderHeader(h)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {result.tableRows.map((row, ri) => {
              const isZRow = row.base === 'Z';
              return (
                <tr
                  key={ri}
                  className={`border-b border-slate-100 last:border-0 ${
                    isZRow ? 'bg-green-50' : 'hover:bg-slate-50/60'
                  }`}
                >
                  {/* Base cell */}
                  <td className={`px-6 py-3.5 text-sm font-semibold text-left ${isZRow ? 'text-green-700' : 'text-slate-700'}`}>
                    {renderBase(row.base)}
                  </td>
                  {/* Value cells */}
                  {row.values.map((v, ci) => {
                    const isRhs = ci === row.values.length - 1;
                    const isZero = Math.abs(v) < 1e-10;
                    return (
                      <td
                        key={ci}
                        className={`px-5 py-3.5 text-sm text-center font-mono tabular-nums ${
                          isZRow
                            ? isRhs
                              ? 'font-bold text-green-700 bg-green-100/60'
                              : 'font-semibold text-green-700'
                            : isRhs
                            ? 'font-semibold text-slate-800 bg-slate-100/70'
                            : isZero
                            ? 'text-slate-300'
                            : 'text-slate-700'
                        }`}
                      >
                        {isZero && !isRhs ? '0' : formatNum(v)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      
    </div>
  );
}

// ── Gráfica Tab ─────────────────────────────────────────────
function GraficaTab({ problem, result }: { problem: SimplexProblem; result: SimplexResult }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-slate-700" style={{ fontSize: '1.05rem', fontWeight: 500 }}>
          Região de Viabilidade e Ponto Ótimo
        </p>
        {result.twoVarProblem && (
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            {problem.constraints.map((c, i) => {
              const colors = ['text-blue-500', 'text-red-500', 'text-violet-500', 'text-orange-500', 'text-teal-500'];
              const lineColors = ['bg-blue-500', 'bg-red-500', 'bg-violet-500', 'bg-orange-500', 'bg-teal-500'];
              return (
                <span key={c.id} className={`flex items-center gap-1.5 ${colors[i % colors.length]}`}>
                  <span className={`inline-block w-5 h-[2px] rounded-full ${lineColors[i % lineColors.length]}`} />
                  Restrição {i + 1}
                </span>
              );
            })}
            <span className="flex items-center gap-1.5 text-amber-500">
              <span className="inline-block w-5 border-t-2 border-dashed border-amber-400" />
              Curva de nível (Z)
            </span>
            <span className="flex items-center gap-1.5 text-amber-600">
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block border-2 border-white shadow" />
              Solução Ótima
            </span>
            {result.integerOptimalPoint && (
              <>
                <span className="flex items-center gap-1.5 text-violet-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-400 inline-block border border-white" />
                  Pontos inteiros viáveis
                </span>
                <span className="flex items-center gap-1.5 text-violet-700">
                  <span className="w-3 h-3 rounded-full bg-violet-600 inline-block border-2 border-white shadow" />
                  Solução inteira ótima
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
        <FeasibilityChart problem={problem} result={result} />
      </div>

      {result.twoVarProblem && (
        <div className="flex flex-wrap gap-3">
          {result.varValues.map(v => (
            <span key={v.index} className="text-xs bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-700">
              x<sub>{v.index}</sub> = {formatNum(v.value)}
            </span>
          ))}
          <span className="text-xs bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-700">
            Z* = {formatNum(result.optimalZ)}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Dual Tab ────────────────────────────────────────────────
function DualTab({ result }: { result: SimplexResult }) {
  const dual = result.dualResult;

  if (!dual) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 min-h-[220px] flex items-center justify-center p-8">
        <p className="text-orange-500 text-sm text-center">
          A solução dual ainda não foi calculada para este problema.
        </p>
      </div>
    );
  }

  if (dual.status === 'error' || !dual.isOptimal) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 min-h-[120px] flex items-center justify-center p-8">
        <p className="text-red-600 text-sm text-center">
          {dual.message ?? `Não foi possível resolver o problema dual (status: ${dual.status}).`}
        </p>
      </div>
    );
  }

  const f = dual.formulation;
  const objLabel = f.objectiveType === 'minimize' ? 'min' : 'max';
  const isStrongDuality = Math.abs(dual.optimalZ - result.optimalZ) < 1e-4;

  const fmtCoef = (v: number, first: boolean): string => {
    if (first) return v < 0 ? `-${formatNum(Math.abs(v))}` : `${formatNum(v)}`;
    return v < 0 ? ` − ${formatNum(Math.abs(v))}` : ` + ${formatNum(v)}`;
  };

  const renderExpr = (coeffs: number[]): ReactNode =>
    coeffs.map((v, i) => (
      <span key={i}>
        {fmtCoef(v, i === 0)}<em>y</em><sub>{i + 1}</sub>
      </span>
    ));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-slate-700" style={{ fontSize: '1.05rem', fontWeight: 500 }}>
          Solução do Problema Dual
        </p>
        <p className="text-slate-500 text-sm mt-1.5">
          O problema dual associa uma variável <em>y<sub>i</sub></em> a cada restrição do primal.
          Pela <strong>dualidade forte</strong>, o valor ótimo do dual coincide com o do primal.
        </p>
      </div>

      {dual.standardized && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <strong>Observação:</strong> o primal contém restrições mistas (<code>{'>='}</code> ou <code>=</code>),
          então foi padronizado para a forma <em>max + todas <code>{'<='}</code></em> antes da dualização.
          O número de variáveis duais pode ser maior que o de restrições do primal original.
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-3">Formulação</p>
        <div className="font-mono text-sm text-slate-800 leading-7">
          <div>
            <span className="font-semibold text-slate-600">{objLabel}</span>
            &nbsp;<em>Z</em> = {renderExpr(f.objCoeffs)}
          </div>
          <div className="text-slate-600 mt-2">sujeito a:</div>
          <div className="ml-4">
            {f.constraints.map((c, ci) => (
              <div key={ci}>
                {renderExpr(c.coefficients)}
                <span className="mx-2 text-slate-500">{c.op === '<=' ? '≤' : c.op === '>=' ? '≥' : '='}</span>
                <span className="font-semibold">{formatNum(c.rhs)}</span>
              </div>
            ))}
            <div className="text-slate-600 mt-1">
              {f.objCoeffs.map((_, i) => (
                <span key={i}>
                  {i > 0 && ', '}<em>y</em><sub>{i + 1}</sub>
                </span>
              ))}
              &nbsp;≥ 0
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <Target className="text-green-600" size={18} />
          <div>
            <p className="text-green-700 text-xs font-medium">Z* do dual</p>
            <p className="text-green-800 font-bold font-[Inter]" style={{ fontSize: '1.4rem', lineHeight: 1.1 }}>
              {formatNum(dual.optimalZ)}
            </p>
          </div>
          {isStrongDuality && (
            <span className="text-xs text-green-700 bg-green-100 rounded-md px-2 py-1 ml-2">
              = Z* primal ✓
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {dual.varValues.map(v => (
            <span key={v.index} className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono text-slate-700">
              <em>y</em><sub>{v.index}</sub> = {formatNum(v.value)}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-3">
          Última Iteração (Quadro Ótimo do Dual)
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {dual.tableHeaders.map((h, i) => {
                  const isRhs = h === 'b';
                  const isBase = h === 'Base';
                  return (
                    <th
                      key={i}
                      className={`px-5 py-3 text-sm font-semibold text-center ${
                        isBase ? 'text-left pl-6 text-slate-600' :
                        isRhs ? 'text-slate-700 bg-slate-100' :
                        (h.startsWith('F') || h.startsWith('e')) ? 'text-slate-500' :
                        'text-slate-700'
                      }`}
                    >
                      {renderHeader(h)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {dual.tableRows.map((row, ri) => {
                const isZRow = row.base === 'Z';
                return (
                  <tr
                    key={ri}
                    className={`border-b border-slate-100 last:border-0 ${
                      isZRow ? 'bg-green-50' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <td className={`px-6 py-3.5 text-sm font-semibold text-left ${isZRow ? 'text-green-700' : 'text-slate-700'}`}>
                      {renderBase(row.base)}
                    </td>
                    {row.values.map((v, ci) => {
                      const isRhs = ci === row.values.length - 1;
                      const isZero = Math.abs(v) < 1e-10;
                      return (
                        <td
                          key={ci}
                          className={`px-5 py-3.5 text-sm text-center font-mono tabular-nums ${
                            isZRow
                              ? isRhs
                                ? 'font-bold text-green-700 bg-green-100/60'
                                : 'font-semibold text-green-700'
                              : isRhs
                              ? 'font-semibold text-slate-800 bg-slate-100/70'
                              : isZero
                              ? 'text-slate-300'
                              : 'text-slate-700'
                          }`}
                        >
                          {isZero && !isRhs ? '0' : formatNum(v)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Inteira Tab ──────────────────────────────────────────────
function InteiraTab({ result }: { result: SimplexResult }) {
  const integer = result.integerResult;

  if (!integer) {
    return (
      <div className="rounded-xl border border-purple-200 bg-purple-50 min-h-[220px] flex items-center justify-center p-8">
        <p className="text-purple-500 text-sm text-center">
          A solução inteira ainda não foi calculada para este problema.
        </p>
      </div>
    );
  }

  if (integer.status === 'error' || (!integer.isOptimal && integer.status !== 'node_limit')) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-red-700 font-medium">Não foi possível obter uma solução inteira</p>
          <p className="text-red-600 text-sm mt-1">
            {integer.message ?? `Status: ${integer.status}.`}
          </p>
        </div>
      </div>
    );
  }

  const isLimit = integer.status === 'node_limit';
  const gap = result.optimalZ - integer.optimalZ;
  const gapPct = Math.abs(result.optimalZ) > 1e-9 ? (gap / result.optimalZ) * 100 : 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-slate-700" style={{ fontSize: '1.05rem', fontWeight: 500 }}>
          Solução Inteira (Branch &amp; Bound)
        </p>
        <p className="text-slate-500 text-sm mt-1.5">
          Restringindo as variáveis a valores inteiros, o algoritmo de
          <strong> Branch &amp; Bound</strong> explorou ramos do problema relaxado,
          podando os que não podiam melhorar o melhor incumbente encontrado.
        </p>
      </div>

      {isLimit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          <strong>Atenção:</strong> {integer.message}
        </div>
      )}

      {/* Optimal Z + integer variable values */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="bg-purple-50 border border-purple-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <CircleDot className="text-purple-600" size={18} />
          <div>
            <p className="text-purple-700 text-xs font-medium">Z* inteiro</p>
            <p className="text-purple-800 font-bold font-[Inter]" style={{ fontSize: '1.4rem', lineHeight: 1.1 }}>
              {formatNum(integer.optimalZ)}
            </p>
          </div>
          {Math.abs(gap) < 1e-4 && (
            <span className="text-xs text-purple-700 bg-purple-100 rounded-md px-2 py-1 ml-2">
              = Z* contínuo ✓
            </span>
          )}
          {Math.abs(gap) >= 1e-4 && (
            <span className="text-xs text-purple-600 bg-purple-100 rounded-md px-2 py-1 ml-2">
              gap: {formatNum(Math.abs(gap))} ({Math.abs(gapPct).toFixed(1)}%)
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {integer.varValues.map(v => (
            <span key={v.index} className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono text-slate-700">
              <em>x</em><sub>{v.index}</sub> = {formatNum(v.value)}
            </span>
          ))}
        </div>
      </div>

      {/* Tableau of the winning node */}
      <div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-3">
          Última Iteração (Quadro Ótimo do Nó Vencedor)
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {integer.tableHeaders.map((h, i) => {
                  const isRhs = h === 'b';
                  const isBase = h === 'Base';
                  return (
                    <th
                      key={i}
                      className={`px-5 py-3 text-sm font-semibold text-center ${
                        isBase ? 'text-left pl-6 text-slate-600' :
                        isRhs ? 'text-slate-700 bg-slate-100' :
                        (h.startsWith('F') || h.startsWith('e')) ? 'text-slate-500' :
                        'text-slate-700'
                      }`}
                    >
                      {renderHeader(h)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {integer.tableRows.map((row, ri) => {
                const isZRow = row.base === 'Z';
                return (
                  <tr
                    key={ri}
                    className={`border-b border-slate-100 last:border-0 ${
                      isZRow ? 'bg-purple-50' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <td className={`px-6 py-3.5 text-sm font-semibold text-left ${isZRow ? 'text-purple-700' : 'text-slate-700'}`}>
                      {renderBase(row.base)}
                    </td>
                    {row.values.map((v, ci) => {
                      const isRhs = ci === row.values.length - 1;
                      const isZero = Math.abs(v) < 1e-10;
                      return (
                        <td
                          key={ci}
                          className={`px-5 py-3.5 text-sm text-center font-mono tabular-nums ${
                            isZRow
                              ? isRhs
                                ? 'font-bold text-purple-700 bg-purple-100/60'
                                : 'font-semibold text-purple-700'
                              : isRhs
                              ? 'font-semibold text-slate-800 bg-slate-100/70'
                              : isZero
                              ? 'text-slate-300'
                              : 'text-slate-700'
                          }`}
                        >
                          {isZero && !isRhs ? '0' : formatNum(v)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Branch & Bound log */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-3">
          Log da Exploração (Branch &amp; Bound)
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
            <p className="text-xs text-slate-500">Nós explorados</p>
            <p className="text-slate-800 font-bold font-mono" style={{ fontSize: '1.1rem' }}>{integer.log.nodesExplored}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
            <p className="text-xs text-slate-500">Podas por limite</p>
            <p className="text-slate-800 font-bold font-mono" style={{ fontSize: '1.1rem' }}>{integer.log.prunedByBound}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
            <p className="text-xs text-slate-500">Podas por inviabilidade</p>
            <p className="text-slate-800 font-bold font-mono" style={{ fontSize: '1.1rem' }}>{integer.log.prunedByInfeasibility}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
            <p className="text-xs text-slate-500">Profundidade máxima</p>
            <p className="text-slate-800 font-bold font-mono" style={{ fontSize: '1.1rem' }}>{integer.log.maxDepth}</p>
          </div>
        </div>

        {integer.log.incumbentHistory.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 font-medium mb-2">Histórico de incumbentes (melhores soluções encontradas):</p>
            <div className="flex flex-col gap-1.5">
              {integer.log.incumbentHistory.map((h, idx) => (
                <div key={idx} className="flex flex-wrap gap-2 items-center text-xs">
                  <span className="text-slate-500 font-mono w-32">nó #{h.nodeId} (prof. {h.depth})</span>
                  <span className="bg-white border border-slate-200 rounded px-2 py-0.5 font-mono text-slate-700">
                    Z = {formatNum(h.z)}
                  </span>
                  <span className="text-slate-500">→</span>
                  {h.solution.map((v, i) => (
                    <span key={i} className="bg-white border border-slate-200 rounded px-2 py-0.5 font-mono text-slate-700">
                      <em>x</em><sub>{i + 1}</sub> = {v}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────
export function ResultsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>('primal');

  const state = location.state as { problem: SimplexProblem; result: SimplexResult } | null;

  if (!state) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Nenhum resultado disponível.</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-[#1b2b3a] text-white rounded-lg text-sm"
          >
            Voltar ao início
          </button>
        </div>
      </div>
    );
  }

  const { problem, result } = state;

  const visibleTabs = TABS.filter(tab => {
    if (tab.id === 'dual') return problem.calcDual;
    if (tab.id === 'inteira') return problem.seekInteger;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* Header */}
      <header className="bg-[#1b2b3a] shadow-md">
        <div className="w-[75%] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-white font-semibold tracking-wide text-lg">JPAD</span>
                <span className="text-slate-300 font-light text-lg tracking-widest">Simplex</span>
                
              </div>
              <p className="text-slate-500 text-xs tracking-wide">Solucionador de Programação Linear</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 w-[75%] mx-auto py-8 flex flex-col gap-6">

        {/* Page title + back button */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-slate-800">Resultados da Otimização</h1>
            <p className="text-slate-500 text-sm mt-1">
              Solução ótima encontrada pelo algoritmo Simplex.
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50 shadow-sm transition-all whitespace-nowrap flex-shrink-0"
          >
            <ArrowLeft size={14} />
            Voltar
          </button>
        </div>

        {/* Metric cards */}
        <div className="flex items-center gap-4">
          {/* Z card — sempre à esquerda */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-4 flex-shrink-0">
            <div className="bg-green-100 rounded-xl p-3 flex-shrink-0">
              <Target className="text-green-600" size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-green-700 text-sm font-medium">Valor Ótimo (Z)</p>
              <p className="text-green-800 font-bold font-[Inter]" style={{ fontSize: '2rem', lineHeight: 1.1 }}>
                {formatNum(result.optimalZ)}
              </p>
            </div>
          </div>

          {/* Variable cards — à direita, compactas e em wrap */}
          <div className="grid gap-3 flex-1 content-start" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {result.varValues.map((v) => (
              <div
                key={v.index}
                className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm"
              >
                <div className="bg-blue-100 rounded-lg p-2 flex-shrink-0">
                  <TrendingUp className="text-blue-600" size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-slate-500 font-medium" style={{ fontSize: '0.72rem' }}>
                    Variável x<sub>{v.index}</sub>
                  </p>
                  <p className="text-slate-800 font-bold font-[Inter]" style={{ fontSize: '1.25rem', lineHeight: 1.1 }}>
                    {formatNum(v.value)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Multiple optimal solutions notice */}
        {result.hasMultipleSolutions && result.alternativeSolutions && result.alternativeSolutions.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex gap-4">
            <div className="bg-amber-100 rounded-xl p-2.5 flex-shrink-0 h-fit">
              <Sparkles className="text-amber-600" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-amber-800 font-medium" style={{ fontSize: '0.95rem' }}>
                Este problema possui múltiplas soluções ótimas
              </p>
              <p className="text-amber-700 text-sm mt-1">
                Existem outras combinações de variáveis que produzem o mesmo valor ótimo <em>Z</em> = {formatNum(result.optimalZ)}.
                Qualquer ponto sobre o segmento entre estas soluções também é ótimo.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <p className="text-xs text-amber-700 font-medium uppercase tracking-wide">Soluções alternativas:</p>
                <div className="flex flex-col gap-1.5">
                  {result.alternativeSolutions.map((alt, idx) => (
                    <div key={idx} className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs text-amber-600 font-medium w-14">Alt. {idx + 1}:</span>
                      {alt.map(v => (
                        <span key={v.index} className="text-xs bg-white border border-amber-200 rounded-lg px-2.5 py-1 font-mono text-amber-800">
                          x<sub>{v.index}</sub> = {formatNum(v.value)}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs panel */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">

          {/* Tab bar */}
          <div className="flex border-b border-slate-200 overflow-x-auto overflow-y-hidden">
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-5 text-sm transition-all border-b-2 -mb-px flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-blue-600 font-medium'
                    : 'text-slate-400 border-transparent hover:text-slate-600 hover:border-slate-300'
                }`}
              >
                <span className={activeTab === tab.id ? 'text-blue-600' : 'text-slate-400'}>
                  {tab.icon}
                </span>
                <span className="flex flex-row items-center gap-1.5">
                  <span>{tab.label}</span>
                  {tab.sublabel && (
                    <span className={`text-xs ${activeTab === tab.id ? 'text-blue-500' : 'text-slate-400'}`}>
                      {tab.sublabel}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-6">
            {activeTab === 'primal' && <PrimalTab result={result} />}
            {activeTab === 'grafica' && <GraficaTab problem={problem} result={result} />}
            {activeTab === 'dual' && <DualTab result={result} />}
            {activeTab === 'inteira' && <InteiraTab result={result} />}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-2">
        <div className="max-w-5xl mx-auto px-6 py-3 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
          <span>JPAD Simplex · Engenharia de Sistemas</span>
          
        </div>
      </footer>
    </div>
  );
}