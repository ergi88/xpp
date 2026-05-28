import { ColumnDef, Row } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Page } from "./Page";
import { PageHeader } from "./PageHeader";
import { DataTable } from "./DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ListPageSearchProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

interface ListPageProps<T> {
    title: string;
    description?: string;
    createLink?: string;
    createLabel?: string;
    search?: ListPageSearchProps;
    data: T[];
    columns: ColumnDef<T>[];
    isLoading?: boolean;
    emptyTitle?: string;
    emptyDescription?: string;
    getRowClassName?: (row: Row<T>) => string | undefined;
    extraActions?: React.ReactNode;
}

export function ListPage<T>({
    title,
    description,
    createLink,
    createLabel,
    search,
    data,
    columns,
    isLoading,
    emptyTitle,
    emptyDescription,
    getRowClassName,
    extraActions,
}: ListPageProps<T>) {
    const searchNode = search ? (
        <Input
            type="search"
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder ?? `Search ${title.toLowerCase()}`}
            className="w-full sm:w-72"
        />
    ) : null;

    const actions =
        searchNode || extraActions ? (
            <>
                {searchNode}
                {extraActions}
            </>
        ) : undefined;

    return (
        <Page title={title}>
            <PageHeader
                title={title}
                description={description}
                createLink={createLink}
                createLabel={createLabel}
                actions={actions}
            />
            <DataTable
                data={data}
                columns={columns}
                isLoading={isLoading}
                emptyTitle={emptyTitle ?? `No ${title.toLowerCase()} found`}
                emptyDescription={
                    emptyDescription ??
                    `Create your first ${title.toLowerCase().slice(0, -1)} to get started`
                }
                getRowClassName={getRowClassName}
                emptyAction={
                    createLink ? (
                        <Button asChild>
                            <Link to={createLink}>
                                <Plus className="size-4" />
                                {createLabel ?? "Create"}
                            </Link>
                        </Button>
                    ) : undefined
                }
            />
        </Page>
    );
}
