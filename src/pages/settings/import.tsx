import { Page, PageHeader } from '@/components/shared'
import { CsvImportWizard } from '@/components/features/import/CsvImportWizard'
import { Card, CardContent } from '@/components/ui/card'
import { ShieldAlert } from 'lucide-react'

export default function ImportSettingsPage() {
    const isReadOnly = false

    return (
        <Page title="Import Transactions">
            <PageHeader
                title="Import Transactions"
                description="Import transactions from a CSV file"
            />
            {isReadOnly ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <ShieldAlert className="size-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">Read-Only Mode</h3>
                        <p className="text-muted-foreground max-w-md">
                            You don't have permission to import transactions. Please contact an administrator if you need write access.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <CsvImportWizard />
            )}
        </Page>
    )
}
