import { useTransactionSummary } from '@/hooks';
import { FundWidget } from './FundWidget';
import { TransactionSummaryCard, type SummaryCardData } from './TransactionSummaryCard';

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function nDaysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function startOfMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function startOfPrevMonthISO(): string {
  const d = new Date();
  const year = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
  const month = d.getMonth() === 0 ? 12 : d.getMonth();
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function endOfPrevMonthISO(): string {
  const d = new Date();
  d.setDate(0);
  return d.toISOString().slice(0, 10);
}

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

function changeLabel(current: number, previous: number): string {
  if (previous === 0 && current === 0) return '0%';
  if (previous === 0 && current > 0) return '+∞%';
  if (previous === 0 && current < 0) return '-∞%';
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(0)}%`;
}

function buildCard(
  label: string,
  income: number,
  expense: number,
  prevIncome: number,
  prevExpense: number,
  symbol: string,
  decimals: number,
): SummaryCardData {
  const net = income - expense;
  const prevNet = prevIncome - prevExpense;
  return {
    label,
    net: formatMoney(net, symbol, decimals),
    netPositive: net >= 0,
    change: changeLabel(net, prevNet),
    changePositive: net >= prevNet,
    income: formatMoney(income, symbol, decimals),
    incomeChange: changeLabel(income, prevIncome),
    expense: formatMoney(expense, symbol, decimals),
    expenseChange: changeLabel(expense, prevExpense),
  };
}

const CARD_CONTAINER = "h-[320px] rounded-[48px] border-2 border-[#E0DEDA] bg-[#FBFCF9] shadow-md dark:border-white/10 dark:bg-zinc-900 flex-1 overflow-hidden";

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

  const cards: SummaryCardData[] = [
    buildCard('Today', daily?.income ?? 0, daily?.expense ?? 0, 0, 0, symbol, decimals),
    buildCard('This Week', weekly?.income ?? 0, weekly?.expense ?? 0, prevWeekly?.income ?? 0, prevWeekly?.expense ?? 0, symbol, decimals),
    buildCard('This Month', monthly?.income ?? 0, monthly?.expense ?? 0, prevMonthly?.income ?? 0, prevMonthly?.expense ?? 0, symbol, decimals),
    buildCard('All Time', allTime?.income ?? 0, allTime?.expense ?? 0, 0, 0, symbol, decimals),
  ];

  return (
    <div className="w-full">
      {/* Mobile: slider */}
      <div className="lg:hidden">
        <FundWidget
          slides={cards.map((data) => (
            <TransactionSummaryCard key={data.label} {...data} />
          ))}
        />
      </div>

      {/* Desktop: full-width row */}
      <div className="hidden lg:flex gap-4">
        {cards.map((data) => (
          <div key={data.label} className={CARD_CONTAINER}>
            <TransactionSummaryCard {...data} />
          </div>
        ))}
      </div>
    </div>
  );
}
