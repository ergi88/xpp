import { useWidgetSummaries } from '@/hooks'
import { FundWidget } from './FundWidget'
import { TransactionSummaryCard, type SummaryCardData } from './TransactionSummaryCard'

const CARD_CONTAINER =
  'rounded-2xl border border-[#E0DEDA] bg-[#FBFCF9] shadow-md dark:border-white/10 dark:bg-zinc-900 flex-1 overflow-hidden'

export function TransactionWidgets() {
  const { data } = useWidgetSummaries()

  if (!data) return null

  const { currency, decimals, today, yesterday, thisWeek, prevWeek, thisMonth, prevMonth, allTime } = data

  const cards: SummaryCardData[] = [
    {
      label: 'Today',
      comparisonLabel: 'vs Yesterday',
      currency,
      decimals,
      income: today.income,
      expense: today.expense,
      prevIncome: yesterday.income,
      prevExpense: yesterday.expense,
    },
    {
      label: 'This Week',
      comparisonLabel: 'vs Last Week',
      currency,
      decimals,
      income: thisWeek.income,
      expense: thisWeek.expense,
      prevIncome: prevWeek.income,
      prevExpense: prevWeek.expense,
    },
    {
      label: 'This Month',
      comparisonLabel: 'vs Last Month',
      currency,
      decimals,
      income: thisMonth.income,
      expense: thisMonth.expense,
      prevIncome: prevMonth.income,
      prevExpense: prevMonth.expense,
    },
    {
      label: 'All Time',
      comparisonLabel: '',
      currency,
      decimals,
      income: allTime.income,
      expense: allTime.expense,
      prevIncome: 0,
      prevExpense: 0,
    },
  ]

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
      <div className="hidden lg:flex gap-3">
        {cards.map((data) => (
          <div key={data.label} className={CARD_CONTAINER}>
            <TransactionSummaryCard {...data} />
          </div>
        ))}
      </div>
    </div>
  )
}
