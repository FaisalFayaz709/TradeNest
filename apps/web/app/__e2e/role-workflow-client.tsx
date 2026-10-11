'use client';

import { useState } from 'react';

export type E2eFixture = {
  role: 'BUYER' | 'SELLER' | 'ADMIN';
  email: string;
  password: string;
};

type WorkflowResult = {
  role: E2eFixture['role'];
  user: { email: string; role: E2eFixture['role'] };
  probe: unknown;
};

export function RoleWorkflowClient({ fixtures }: { fixtures: E2eFixture[] }) {
  const [results, setResults] = useState<Partial<Record<E2eFixture['role'], WorkflowResult>>>({});
  const [errors, setErrors] = useState<Partial<Record<E2eFixture['role'], string>>>({});

  async function run(fixture: E2eFixture) {
    setErrors((current) => { const next = { ...current }; delete next[fixture.role]; return next; });
    const response = await fetch('/api/__e2e/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(fixture),
    });
    const payload = await response.json() as { data?: WorkflowResult; error?: string };
    if (!response.ok || !payload.data) {
      setErrors((current) => ({ ...current, [fixture.role]: payload.error ?? `HTTP ${response.status}` }));
      return;
    }
    setResults((current) => ({ ...current, [fixture.role]: payload.data }));
  }

  return (
    <section className="grid gap-4 md:grid-cols-3">
      {fixtures.map((fixture) => (
        <article key={fixture.role} className="rounded-xl border border-[var(--tradenest-border)] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">{fixture.role}</h2>
          <p className="mt-1 break-all text-sm text-[var(--tradenest-text-secondary)]">{fixture.email}</p>
          <button
            type="button"
            className="mt-4 rounded-md bg-[var(--tradenest-navy)] px-4 py-2 text-sm font-semibold text-white"
            onClick={() => void run(fixture)}
          >
            Run {fixture.role} workflow
          </button>
          {results[fixture.role] ? (
            <pre data-testid={`result-${fixture.role}`} className="mt-4 overflow-auto rounded-md bg-slate-50 p-3 text-xs">
              {JSON.stringify(results[fixture.role], null, 2)}
            </pre>
          ) : null}
          {errors[fixture.role] ? (
            <p data-testid={`error-${fixture.role}`} className="mt-4 text-sm text-red-700">{errors[fixture.role]}</p>
          ) : null}
        </article>
      ))}
    </section>
  );
}
