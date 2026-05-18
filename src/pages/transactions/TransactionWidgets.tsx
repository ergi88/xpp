import { useTransactionSummary } from '@/hooks';
import { FundWidget, type FundItem } from './FundWidget';

// Helper: today as YYYY-MM-DD
function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

// Helper: N days ago as YYYY-MM-DD
function nDaysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// Helper: first day of current month as YYYY-MM-DD
function startOfMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// Helper: first day of previous calendar month as YYYY-MM-DD
function startOfPrevMonthISO(): string {
  const d = new Date();
  const year = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
  const month = d.getMonth() === 0 ? 12 : d.getMonth();
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

// Helper: last day of previous calendar month as YYYY-MM-DD (= day before start of current month)
function endOfPrevMonthISO(): string {
  const d = new Date();
  // Set to day 0 of this month = last day of previous month
  d.setDate(0);
  return d.toISOString().slice(0, 10);
}

// Format money: if >= 1M show "1.2M", if >= 1K show "1.5K", else show "1234.56"
// Prepend symbol; negative sign goes before symbol
function formatMoney(amount: number, symbol: string, decimals: number): string {
  const negative = amount < 0;
  const abs = Math.abs(amount);
  let formatted: string;

  if (abs >= 1_000_000) {
    formatted = `${(abs / 1_000_000).toFixed(1)}M`;
  } else if (abs >= 1_000) {
    formatted = `${(abs / 1_000).toFixed(1)}K`;
  } else {
    formatted = abs.toFixed(decimals);
  }

  return negative ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

// Format change vs previous period as "+12%" or "-5%"
// If previous is 0 and current > 0: "+∞%", if both 0: "0%"
function changeLabel(current: number, previous: number): string {
  if (previous === 0 && current === 0) return '0%';
  if (previous === 0 && current > 0) return '+∞%';
  if (previous === 0 && current < 0) return '-∞%';
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(0)}%`;
}

export function TransactionWidgets() {
  const today = todayISO();
  const weekStart = nDaysAgoISO(7);
  const prevWeekStart = nDaysAgoISO(14);
  const prevWeekEnd = nDaysAgoISO(8);
  const monthStart = startOfMonthISO();
  const prevMonthStart = startOfPrevMonthISO();
  const prevMonthEnd = endOfPrevMonthISO();

  const { data: daily } = useTransactionSummary({ start_date: today, end_date: today });
  const { data: weekly } = useTransactionSummary({ start_date: weekStart, end_date: today });
  const { data: prevWeekly } = useTransactionSummary({ start_date: prevWeekStart, end_date: prevWeekEnd });
  const { data: monthly } = useTransactionSummary({ start_date: monthStart, end_date: today });
  const { data: prevMonthly } = useTransactionSummary({ start_date: prevMonthStart, end_date: prevMonthEnd });
  const { data: allTime } = useTransactionSummary();

  const symbol = daily?.currency ?? monthly?.currency ?? allTime?.currency ?? '$';
  const decimals = daily?.decimals ?? monthly?.decimals ?? allTime?.decimals ?? 2;

  const dailyBalance = (daily?.income ?? 0) - (daily?.expense ?? 0);
  const weeklyBalance = (weekly?.income ?? 0) - (weekly?.expense ?? 0);
  const prevWeeklyBalance = (prevWeekly?.income ?? 0) - (prevWeekly?.expense ?? 0);
  const monthlyBalance = (monthly?.income ?? 0) - (monthly?.expense ?? 0);
  const prevMonthlyBalance = (prevMonthly?.income ?? 0) - (prevMonthly?.expense ?? 0);
  const allTimeBalance = (allTime?.income ?? 0) - (allTime?.expense ?? 0);

  const items: FundItem[] = [
    {
      id: 'daily',
      label: 'Today',
      value: formatMoney(dailyBalance, symbol, decimals),
      change: changeLabel(dailyBalance, 0),
    },
    {
      id: 'weekly',
      label: 'This Week',
      value: formatMoney(weeklyBalance, symbol, decimals),
      change: changeLabel(weeklyBalance, prevWeeklyBalance),
    },
    {
      id: 'monthly',
      label: 'This Month',
      value: formatMoney(monthlyBalance, symbol, decimals),
      change: changeLabel(monthlyBalance, prevMonthlyBalance),
    },
    {
      id: 'alltime',
      label: 'All Time',
      value: formatMoney(allTimeBalance, symbol, decimals),
      change: changeLabel(allTimeBalance, 0),
    },
  ];

  return <FundWidget data={items} />;
}
