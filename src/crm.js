export function conversionRate(contacts) {
  const won = contacts.filter((c) => c.stage === 'ganho').length;
  const closed = contacts.filter((c) => ['ganho', 'perdido'].includes(c.stage)).length;
  return closed ? (won / closed) * 100 : null;
}

export function localDate(value = new Date()) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function shortMoney(value) {
  const amount = Number(value || 0);
  return `R$ ${amount.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`;
}

function normalizedPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
}

export function validateContact(contact) {
  if (!String(contact.name || '').trim()) return 'Informe o nome do contato.';
  if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) return 'Informe um e-mail válido.';
  if (contact.phone) {
    const phone = String(contact.phone).replace(/\D/g, '');
    if (phone.length < 8 || phone.length > 15 || /^(\d)\1+$/.test(phone)) return 'Informe um telefone válido, com DDD (e código do país para números internacionais).';
  }
  if (!Number.isFinite(Number(contact.value || 0)) || Number(contact.value || 0) < 0) return 'O valor estimado deve ser zero ou positivo.';
  return '';
}

export function duplicateContact(contact, contacts) {
  const email = String(contact.email || '').trim().toLowerCase();
  const phone = normalizedPhone(contact.phone);
  return contacts.find((existing) => existing.id !== contact.id && (
    (email && String(existing.email || '').trim().toLowerCase() === email) ||
    (phone && normalizedPhone(existing.phone) === phone)
  ));
}
