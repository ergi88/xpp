import { FormPage } from '@/components/shared'
import { TagForm } from '@/components/features/tags'
import { useCreateTag } from '@/hooks'

export default function CreateTagPage() {
    const createTag = useCreateTag('/tags')

    return (
        <FormPage title="Create Tag" backLink="/tags">
            <TagForm
                onSubmit={createTag.mutate}
                isSubmitting={createTag.isPending}
                submitLabel="Create Tag"
            />
        </FormPage>
    )
}
