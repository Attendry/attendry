/**
 * Auto-Expand Date Window Logic
 */

import { SearchCfg } from '@/config/search';

export type Window = {
  from: string;
  to: string;
};

export function computeExpandedWindow(win: Window): Window {
  const from = new Date(win.from);
  const to = new Date(win.to);
  
  const spanDays = Math.ceil((+to - +from) / (24 * 3600 * 1000)) + 1;
  
  if (spanDays >= 14) {
    return win;
  }
  
  const newTo = new Date(from);
  newTo.setDate(newTo.getDate() + 13);
  
  return {
    from: formatDate(from),
    to: formatDate(newTo)
  };
}

export function shouldAutoExpand(solidCount: number): boolean {
  return SearchCfg.allowAutoExpand && solidCount < SearchCfg.minSolidHits;
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
