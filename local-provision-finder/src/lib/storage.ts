import type { ReviewDecision } from '../types';

export function readSaved(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem('lp-saved-v1') ?? '[]');
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string' && /^LP-\d{3}$/.test(v)) : [];
  } catch { return []; }
}
export function readDecisions(): ReviewDecision[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem('lp-decisions-v1') ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((v): v is ReviewDecision => v && typeof v.updateId === 'string' && /^UP-\d{3}$/.test(v.updateId) && ['held','published','rejected'].includes(v.status) && typeof v.decidedOn === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v.decidedOn) && Number.isFinite(Date.parse(v.decidedOn)) && typeof v.verified === 'boolean');
  } catch { return []; }
}
export function saveLocal(key: string, value: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
