import { useEffect } from "react";
import { useSetPageTitle } from "@/lib/page-title-context";

const APP_NAME = "Finix";

interface PageProps {
    title: string;
    children: React.ReactNode;
}

export function Page({ title, children }: PageProps) {
    const setPageTitle = useSetPageTitle();

    useEffect(() => {
        document.title = title ? `${title} | ${APP_NAME}` : APP_NAME;
        setPageTitle(title ?? "");
        return () => {
            document.title = APP_NAME;
            setPageTitle("");
        };
    }, [title, setPageTitle]);

    return <>{children}</>;
}
