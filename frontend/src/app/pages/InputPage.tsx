import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Trash2, ChevronRight, Calculator, Info, X } from 'lucide-react';
import { Logo } from '../components/Logo';
import { ConstraintRow, ConstraintOp, SimplexProblem } from '../types';
import { mockSolve } from '../utils/solver';

let constraintCounter = 3;

function newConstraint(numVars: number): ConstraintRow {
  return {
    id: String(constraintCounter++),
    coefficients: Array(numVars).fill('0'),
    op: '<=',
    rhs: '0',
  };
}

export function InputPage() {
  const navigate = useNavigate();

  const [objectiveType, setObjectiveType] = useState<'maximize' | 'minimize'>('maximize');
  const [numVars, setNumVars] = useState(2);
  const [objCoeffs, setObjCoeffs] = useState<string[]>(['3', '5']);
  const [constraints, setConstraints] = useState<ConstraintRow[]>([
    { id: '1', coefficients: ['1', '0'], op: '<=', rhs: '4' },
    { id: '2', coefficients: ['3', '2'], op: '<=', rhs: '18' },
  ]);
  const [seekInteger, setSeekInteger] = useState(false);
  const [calcDual, setCalcDual] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  /* ── Variable management ── */
  function addVariable() {
    setNumVars(v => v + 1);
    setObjCoeffs(prev => [...prev, '0']);
    setConstraints(prev =>
      prev.map(c => ({ ...c, coefficients: [...c.coefficients, '0'] }))
    );
  }

  function removeVariable(idx: number) {
    if (numVars <= 1) return;
    setNumVars(v => v - 1);
    setObjCoeffs(prev => prev.filter((_, i) => i !== idx));
    setConstraints(prev =>
      prev.map(c => ({ ...c, coefficients: c.coefficients.filter((_, i) => i !== idx) }))
    );
  }

  function setObjCoeff(idx: number, val: string) {
    setObjCoeffs(prev => prev.map((v, i) => (i === idx ? val : v)));
  }

  /* ── Constraint management ── */
  function addConstraint() {
    setConstraints(prev => [...prev, newConstraint(numVars)]);
  }

  function removeConstraint(id: string) {
    if (constraints.length <= 1) return;
    setConstraints(prev => prev.filter(c => c.id !== id));
  }

  function setConstraintCoeff(id: string, varIdx: number, val: string) {
    setConstraints(prev =>
      prev.map(c =>
        c.id === id
          ? { ...c, coefficients: c.coefficients.map((v, i) => (i === varIdx ? val : v)) }
          : c
      )
    );
  }

  function setConstraintOp(id: string, op: ConstraintOp) {
    setConstraints(prev => prev.map(c => (c.id === id ? { ...c, op } : c)));
  }

  function setConstraintRhs(id: string, val: string) {
    setConstraints(prev => prev.map(c => (c.id === id ? { ...c, rhs: val } : c)));
  }

  /* ── Solve ── */
  function handleSolve() {
    const errs: string[] = [];
    if (!objCoeffs.some(c => parseFloat(c) !== 0))
      errs.push('A função objetivo deve ter pelo menos um coeficiente não nulo.');
    if (constraints.length === 0)
      errs.push('Adicione pelo menos uma restrição.');
    constraints.forEach((c, i) => {
      if (isNaN(parseFloat(c.rhs))) errs.push(`Restrição ${i + 1}: valor RHS inválido.`);
    });

    setErrors(errs);
    if (errs.length > 0) return;

    const problem: SimplexProblem = { objectiveType, numVars, objCoeffs, constraints, seekInteger, calcDual };
    const result = mockSolve(problem);
    navigate('/results', { state: { problem, result } });
  }

  /* ── Checkbox helper ── */
  function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
      <div
        onClick={onChange}
        className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all ${
          checked ? 'bg-[#1b2b3a] border-[#1b2b3a]' : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        {checked && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* ── Header ── */}
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

      {/* ── Content ── */}
      <main className="flex-1 w-[75%] mx-auto py-8 flex flex-col gap-6">

        {/* Page title */}
        <div>
          <h1 className="text-slate-800">Configuração do Problema</h1>
          <p className="text-slate-500 text-sm mt-1">
            Defina a função objetivo e as restrições do seu modelo de programação linear.
          </p>
        </div>

        {/* ── Objective Function ── */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
              Função Objetivo
            </span>
            <div className="flex gap-2">
              {(['maximize', 'minimize'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setObjectiveType(type)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-all ${
                    objectiveType === type
                      ? 'bg-[#1b2b3a] border-[#1b2b3a] text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <span
                    className={`w-3 h-3 rounded-full border-2 flex-shrink-0 transition-all ${
                      objectiveType === type ? 'bg-white border-white' : 'border-slate-400'
                    }`}
                  />
                  {type === 'maximize' ? 'Maximizar' : 'Minimizar'}
                </button>
              ))}
            </div>
          </div>
          <div className="px-5 py-5 flex flex-col gap-5">

            {/* Z = ... */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
              <span className="text-slate-600 italic mr-1" style={{ fontSize: '1.1rem' }}>Z =</span>
              {Array.from({ length: numVars }, (_, i) => (
                <div key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-slate-300 mx-0.5 select-none">+</span>}
                  <input
                    type="number"
                    value={objCoeffs[i] ?? '0'}
                    onChange={e => setObjCoeff(i, e.target.value)}
                    className="w-16 text-center bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                  <span className="text-slate-500 text-sm italic select-none">
                    x<sub>{i + 1}</sub>
                  </span>
                  {numVars > 1 && (
                    <button
                      onClick={() => removeVariable(i)}
                      title={`Remover variável x${i + 1}`}
                      className="text-slate-300 hover:text-red-400 transition-colors p-0.5 rounded ml-0.5"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addVariable}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-blue-300 text-blue-600 text-xs hover:bg-blue-50 hover:border-blue-400 transition-all"
              >
                <Plus size={12} />
                Variável
              </button>
              {numVars !== 2 && (
                <button
                  onClick={() => {
                    setNumVars(2);
                    setObjCoeffs(prev => {
                      const next = [...prev];
                      while (next.length < 2) next.push('0');
                      return next.slice(0, 2);
                    });
                    setConstraints(prev =>
                      prev.map(c => {
                        const coeffs = [...c.coefficients];
                        while (coeffs.length < 2) coeffs.push('0');
                        return { ...c, coefficients: coeffs.slice(0, 2) };
                      })
                    );
                  }}
                  title="Resetar para 2 variáveis"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-slate-400 text-xs hover:bg-slate-50 hover:border-slate-400 hover:text-slate-600 transition-all"
                >
                  <X size={12} />
                  Resetar
                </button>
              )}
            </div>

            {/* Info */}
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Info size={11} />
              Variáveis:&nbsp;
              <span className="font-mono">
                {Array.from({ length: numVars }, (_, i) => `x${i + 1}`).join(', ')}
              </span>
              &nbsp;·&nbsp;Não-negatividade implícita (xᵢ ≥ 0)
            </p>
          </div>
        </section>

        {/* ── Constraints ── */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
              Restrições
            </span>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {constraints.length} {constraints.length !== 1 ? 'restrições' : 'restrição'}
            </span>
          </div>
          <div className="px-5 py-5 flex flex-col gap-3">
            {constraints.map((c, rowIdx) => (
              <div key={c.id} className="flex flex-wrap items-center gap-x-2 gap-y-2 group/row">
                {/* Row index */}
                <span className="text-xs text-slate-400 font-mono w-4 text-right flex-shrink-0">
                  {rowIdx + 1}.
                </span>

                {/* Coefficients */}
                {Array.from({ length: numVars }, (_, vi) => (
                  <div key={vi} className="flex items-center gap-1">
                    {vi > 0 && <span className="text-slate-300 text-sm select-none">+</span>}
                    <input
                      type="number"
                      value={c.coefficients[vi] ?? '0'}
                      onChange={e => setConstraintCoeff(c.id, vi, e.target.value)}
                      className="w-14 text-center bg-white border border-slate-300 rounded-lg px-1.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                    <span className="text-slate-500 text-sm italic select-none">
                      x<sub>{vi + 1}</sub>
                    </span>
                  </div>
                ))}

                {/* Operator */}
                <select
                  value={c.op}
                  onChange={e => setConstraintOp(c.id, e.target.value as ConstraintOp)}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all"
                >
                  <option value="<=">≤</option>
                  <option value=">=">≥</option>
                  <option value="=">=</option>
                </select>

                {/* RHS */}
                <input
                  type="number"
                  value={c.rhs}
                  onChange={e => setConstraintRhs(c.id, e.target.value)}
                  className="w-20 text-center bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="0"
                />

                {/* Delete row */}
                {constraints.length > 1 && (
                  <button
                    onClick={() => removeConstraint(c.id)}
                    title="Remover restrição"
                    className="text-slate-300 hover:text-red-400 transition-colors p-1 rounded opacity-0 group-hover/row:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={addConstraint}
              className="flex items-center gap-1.5 px-4 py-2 mt-1 rounded-lg border border-dashed border-slate-300 text-slate-500 text-xs hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all w-fit"
            >
              <Plus size={12} />
              Adicionar Restrição
            </button>
          </div>
        </section>

        {/* ── Options ── */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
              Opções de Solução
            </span>
          </div>
          <div className="px-5 py-4 flex flex-wrap gap-5">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox checked={seekInteger} onChange={() => setSeekInteger(v => !v)} />
              <span className="text-sm text-slate-700">Buscar solução inteira</span>
              
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox checked={calcDual} onChange={() => setCalcDual(v => !v)} />
              <span className="text-sm text-slate-700">Calcular solução dual</span>
              
            </label>
          </div>
        </section>

        {/* ── Errors ── */}
        {errors.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <p className="text-red-700 text-sm font-medium mb-1">Corrija os seguintes erros:</p>
            <ul className="list-disc list-inside text-red-600 text-sm space-y-0.5">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {/* ── Solve button ── */}
        <div className="flex justify-end pb-4">
          <button
            onClick={handleSolve}
            className="flex items-center gap-2 bg-[#1b2b3a] hover:bg-[#243447] active:scale-95 text-white px-8 py-3 rounded-xl text-sm font-medium shadow-md hover:shadow-lg transition-all"
          ><Calculator size={15} />Resolver<ChevronRight size={15} /></button>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-3 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
          <span>JPAD Simplex · Engenharia de Sistemas</span>
          
        </div>
      </footer>
    </div>
  );
}