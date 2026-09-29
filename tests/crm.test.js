import test from 'node:test';
import assert from 'node:assert/strict';
import { conversionRate, localDate, shortMoney, validateContact, duplicateContact } from '../src/crm.js';

test('conversion uses closed deals, including no new leads and large open pipeline', () => {
  const contacts = [{ stage: 'ganho' }, { stage: 'perdido' }, ...Array.from({ length: 40 }, () => ({ stage: 'proposta' }))];
  assert.equal(conversionRate(contacts), 50);
  assert.equal(conversionRate([{ stage: 'ganho' }]), 100);
  assert.equal(conversionRate([{ stage: 'perdido' }]), 0);
  assert.equal(conversionRate([{ stage: 'novo' }]), null);
  assert.equal(conversionRate([]), null);
});

test('money ticks keep distinct amounts below one thousand', () => {
  const ticks = [0, 250, 500, 750, 1000].map(shortMoney);
  assert.equal(new Set(ticks).size, 5);
  assert.equal(shortMoney(1250.5), 'R$ 1.250,5');
});

test('contact validation rejects observed invalid data and accepts optional empty fields', () => {
  const base = { name: 'Ana', email: '', phone: '', value: '' };
  assert.equal(validateContact(base), '');
  for (const patch of [{ name: '  ' }, { email: 'email-invalido' }, { value: -100 }, { value: 'invalid' }, { phone: '00000000000' }]) {
    assert.notEqual(validateContact({ ...base, ...patch }), '');
  }
  assert.equal(validateContact({ ...base, email: 'ana@example.com', phone: '+55 (11) 99999-8888', value: '1000.50' }), '');
});

test('duplicate detection normalizes email, country prefix and formatting; excludes self', () => {
  const contacts = [{ id: '1', email: ' Ana@example.com ', phone: '+55 (11) 99999-8888' }];
  assert.equal(duplicateContact({ email: 'ANA@example.com' }, contacts)?.id, '1');
  assert.equal(duplicateContact({ phone: '11999998888' }, contacts)?.id, '1');
  assert.equal(duplicateContact({ ...contacts[0] }, contacts), undefined);
  assert.equal(duplicateContact({ name: 'Ana', email: '', phone: '' }, contacts), undefined);
});

test('date-only fields preserve their calendar date; timestamps use local timezone', () => {
  assert.equal(localDate('2026-09-29'), '2026-09-29');
  assert.equal(localDate('invalid'), '');
  assert.equal(localDate(new Date(2026, 8, 29, 23, 30)), '2026-09-29');
  if (process.env.TZ === 'America/Sao_Paulo') {
    assert.equal(localDate('2026-09-30T01:30:00Z'), '2026-09-29');
  }
});
