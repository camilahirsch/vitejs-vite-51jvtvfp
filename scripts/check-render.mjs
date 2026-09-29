// Smoke checks of rendered text and semantics; does not replace browser visual QA.
import { createServer } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import assert from 'node:assert/strict';

// Dummy public configuration: no auth/data request is performed by these screens.
process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'render-check-only';
process.env.VITE_STRIPE_PAYMENT_LINK = '';
const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  plugins: [{ name: 'render-check-exports', enforce: 'pre', transform(code, id) {
    if (id.endsWith('/src/App.jsx')) return `${code}\nexport { Graficos, Painel, Contatos, AuthScreen, Paywall };`;
  } }],
});
try {
  const { Graficos, Painel, Contatos, AuthScreen, Paywall } = await server.ssrLoadModule('/src/App.jsx');
  const contacts = [
    { id: '1', name: 'QA', stage: 'ganho', value: 1000, created_at: '2026-09-29T12:00:00Z' },
    { id: '2', name: 'QA', stage: 'perdido', value: 500, created_at: '2026-09-29T12:00:00Z' },
  ];
  const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
  const charts = render(Graficos, { contacts });
  const panel = render(Painel, { contacts, tasks: [] });
  assert.ok(charts.includes('<strong>50%</strong>'), 'chart conversion should be 50%');
  assert.ok(panel.includes('50%'), 'panel conversion should be 50%');
  assert.ok(charts.includes('50% de ganhos entre 2 encerrados'), 'closing chart should use the same denominator');
  assert.ok(!charts.includes('% avançam'), 'stage inventory must not claim transition rates');
  assert.ok(charts.includes('Ver dados do gráfico'), 'monthly graphs should have a data table');
  assert.ok(render(Graficos, { contacts: [] }).includes('Ainda não há contatos no funil'), 'empty state should render');
  assert.ok(render(Contatos, { contacts: [], onAdd() {}, onEdit() {}, onRemove() {} }).includes('aria-label="Buscar contatos"'), 'search should have an accessible name');
  assert.ok(render(AuthScreen).includes('color:#FFFFFF'), 'brand title should have explicit contrast');
  assert.ok(!render(Paywall).includes('href="#"'), 'unconfigured payment must not have a broken link');
  console.log('Render checks passed: conversion, stage labels, tables, empty states, search semantics and payment fallback.');
} finally {
  await server.close();
}
