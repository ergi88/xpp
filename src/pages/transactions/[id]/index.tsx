import { useParams, Link, useNavigate } from 'react-router-dom'
import { Page } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { AmountText } from '@/components/shared/AmountText'
import {
    useTransaction,
    useDeleteTransaction,
    useDuplicateTransaction,
    useToggleTransactionFlag,
} from '@/hooks'
import {
    Pencil,
    Copy,
    Trash2,
    ArrowLeft,
    ArrowDownLeft,
    ArrowUpRight,
    ArrowLeftRight,
    Ban,
    Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const TYPE_CONFIG = {
    income: { icon: ArrowDownLeft, color: 'text-green-600', label: 'Income' },
    expense: { icon: ArrowUpRight, color: 'text-red-600', label: 'Expense' },
    transfer: { icon: ArrowLeftRight, color: 'text-blue-600', label: 'Transfer' },
}

export default function TransactionViewPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { data: t, isLoading } = useTransaction(id!)
    const deleteTransaction = useDeleteTransaction()
    const duplicateTransaction = useDuplicateTransaction()
    const toggleFlag = useToggleTransactionFlag()

    const handleDelete = () => {
        if (!id) return
        deleteTransaction.mutate(id, {
            onSuccess: () => navigate('/transactions'),
        })
    }

    if (isLoading) {
        return (
            <Page title="Transaction">
                <div className="p-8">Loading...</div>
            </Page>
        )
    }
    if (!t) {
        return (
            <Page title="Transaction">
                <div className="p-8">Transaction not found.</div>
            </Page>
        )
    }

    const cfg = TYPE_CONFIG[t.type]
    const Icon = cfg.icon
    const decimals = t.account.currency?.decimals ?? 2
    const symbol = t.account.currency?.symbol

    return (
        <Page title="Transaction">
            <div className="max-w-3xl mx-auto p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Link to="/transactions" className="hover:underline flex items-center gap-1">
                        <ArrowLeft className="size-3" />
                        Transactions
                    </Link>
                    <span>/</span>
                    <span>{new Date(t.date).toLocaleDateString()}</span>
                </div>

                {/* Hero */}
                <Card>
                    <CardContent className="p-6 space-y-3">
                        <div className="flex items-center gap-3">
                            <Icon className={cn('size-6', cfg.color)} />
                            <div className="text-3xl font-bold font-mono">
                                <AmountText value={t.amount} decimals={decimals} currency={symbol} />
                            </div>
                            <Badge variant="secondary" className={cn('ml-2', cfg.color)}>{cfg.label}</Badge>
                        </div>
                        {t.description && <p className="text-muted-foreground">{t.description}</p>}
                        <div className="flex items-center gap-2 flex-wrap">
                            {t.tags.map(tag => <Badge key={tag.id} variant="outline">#{tag.name}</Badge>)}
                            {t.isOneTime && <Badge variant="secondary">★ One-time</Badge>}
                            {t.isExcluded && <Badge variant="secondary">⊘ Excluded</Badge>}
                        </div>
                    </CardContent>
                </Card>

                {/* Details grid */}
                <Card>
                    <CardContent className="p-6 grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div className="text-muted-foreground">Account</div>
                            <Link to={`/accounts/${t.account.id}`} className="hover:underline font-medium">
                                {t.account.name}
                            </Link>
                        </div>
                        {t.toAccount ? (
                            <div>
                                <div className="text-muted-foreground">To Account</div>
                                <Link to={`/accounts/${t.toAccount.id}`} className="hover:underline font-medium">
                                    {t.toAccount.name}
                                </Link>
                            </div>
                        ) : t.category ? (
                            <div>
                                <div className="text-muted-foreground">Category</div>
                                <span className="font-medium">{t.category.name}</span>
                            </div>
                        ) : null}
                        <div>
                            <div className="text-muted-foreground">Date</div>
                            <div className="font-mono">{new Date(t.date).toLocaleDateString()}</div>
                        </div>
                        {t.createdAt && (
                            <div>
                                <div className="text-muted-foreground">Created</div>
                                <div className="font-mono text-xs">{new Date(t.createdAt).toLocaleString()}</div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Connections panel (placeholders — wired in Phases 3–5) */}
                {(t.recurringId || t.linkedTransactionId || t.debtId) && (
                    <Card>
                        <CardContent className="p-6 space-y-2 text-sm">
                            <div className="font-medium">Connections</div>
                            {t.recurringId && (
                                <Link to={`/recurring/${t.recurringId}/edit`} className="block hover:underline">
                                    ↻ From recurring template →
                                </Link>
                            )}
                            {t.linkedTransactionId && (
                                <Link to={`/transactions/${t.linkedTransactionId}`} className="block hover:underline">
                                    ⇄ Linked counterpart →
                                </Link>
                            )}
                            {t.debtId && (
                                <Link to={`/debts/${t.debtId}/edit`} className="block hover:underline">
                                    $ Debt payment for →
                                </Link>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Action bar */}
                <div className="flex flex-wrap gap-2 justify-end">
                    <Button asChild variant="default">
                        <Link to={`/transactions/${t.id}/edit`}>
                            <Pencil className="size-4 mr-1" />
                            Edit
                        </Link>
                    </Button>
                    <Button variant="outline" onClick={() => duplicateTransaction.mutate(t.id)}>
                        <Copy className="size-4 mr-1" />
                        Duplicate
                    </Button>
                    <Button
                        variant={t.isExcluded ? 'default' : 'outline'}
                        onClick={() => toggleFlag.mutate({ id: t.id, flag: 'is_excluded', value: !t.isExcluded })}
                        disabled={toggleFlag.isPending || t.isOneTime}
                        title={t.isOneTime ? 'Cannot exclude a one-time transaction' : ''}
                    >
                        <Ban className="size-4 mr-1" />
                        {t.isExcluded ? 'Included' : 'Exclude'}
                    </Button>
                    <Button
                        variant={t.isOneTime ? 'default' : 'outline'}
                        onClick={() => toggleFlag.mutate({ id: t.id, flag: 'is_one_time', value: !t.isOneTime })}
                        disabled={toggleFlag.isPending || t.isExcluded}
                        title={t.isExcluded ? 'Cannot mark excluded transaction as one-time' : ''}
                    >
                        <Star className="size-4 mr-1" />
                        {t.isOneTime ? 'Recurring-like' : 'Mark one-time'}
                    </Button>
                    <Button variant="destructive" onClick={handleDelete}>
                        <Trash2 className="size-4 mr-1" />
                        Delete
                    </Button>
                </div>
            </div>
        </Page>
    )
}
