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
  if (h.startsWith('F')) return <><em>F</em><sub>{h.slice(1)}</sub></>;
  return h;
}

function renderBase(b: string): ReactNode {
  if (b === 'Z') return <em className="not-italic font-bold text-green-700">Z</em>;
  if (b.startsWith('x')) return <><em>x</em><sub>{b.slice(1)}</sub></>;
  if (b.startsWith('F')) return <><em>F</em><sub>{b.slice(1)}</sub></>;
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
function DualTab() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-slate-700" style={{ fontSize: '1.05rem', fontWeight: 500 }}>
          Solução do Problema Dual
        </p>
        <p className="text-slate-500 text-sm mt-1.5">Apresentação da tabela para a resoluço do dual:</p>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 min-h-[220px] flex items-center justify-center p-8">
        <p className="text-orange-500 text-sm text-center">
          Layout reservado para a tabela Dual gerada pelo Python.
        </p>
      </div>
    </div>
  );
}

// ── Inteira Tab ──────────────────────────────────────────────
function InteiraTab() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-slate-700" style={{ fontSize: '1.05rem', fontWeight: 500 }}>Solução Inteira</p>
        <p className="text-slate-500 text-sm mt-1.5">Apresentação da solução garantindo que x<sub>1</sub> e x<sub>2</sub> sejam valores inteiros:</p>
      </div>
      <div className="rounded-xl border border-purple-200 bg-purple-50 min-h-[220px] flex items-center justify-center p-8">
        <p className="text-purple-500 text-sm text-center">
          Layout reservado para o log de ramificação e limite ou planos de corte.
        </p>
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
            {activeTab === 'dual' && <DualTab />}
            {activeTab === 'inteira' && <InteiraTab />}
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