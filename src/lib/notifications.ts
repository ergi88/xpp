import type { TransactionFormValues } from "@/schemas";

const STORAGE_KEY = "xpp:notifications";
const MAX_NOTIFICATIONS = 100;

export type NotificationKind =
  | "tx_create_failed"
  | "tx_update_failed"
  | "tx_delete_failed"
  | "balance_effect_failed";

export type NotificationSeverity = "error" | "warning" | "info";

export interface NotificationContext {
  txPayload?: Partial<TransactionFormValues>;
  txId?: string;
  accountId?: string;
  toAccountId?: string;
  debtId?: string;
  error?: string;
}

export interface AppNotification {
  id: string;
  createdAt: string;
  severity: NotificationSeverity;
  kind: NotificationKind;
  title: string;
  message: string;
  context: NotificationContext;
  read: boolean;
  dismissed: boolean;
}

type Listener = (items: AppNotification[]) => void;

const listeners = new Set<Listener>();
let cache: AppNotification[] | null = null;

function read(): AppNotification[] {
  if (cache) return cache;
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cache = [];
      return cache;
    }
    const parsed = JSON.parse(raw) as AppNotification[];
    cache = Array.isArray(parsed) ? parsed : [];
    return cache;
  } catch {
    cache = [];
    return cache;
  }
}

function write(items: AppNotification[]): void {
  cache = items.slice(0, MAX_NOTIFICATIONS);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    } catch {
      /* quota exceeded — silently drop persistence */
    }
  }
  for (const l of listeners) l(cache);
}

function uid(): string {
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const notificationsStore = {
  list(): AppNotification[] {
    return read();
  },

  unreadCount(): number {
    return read().filter((n) => !n.read && !n.dismissed).length;
  },

  push(
    n: Omit<AppNotification, "id" | "createdAt" | "read" | "dismissed">,
  ): AppNotification {
    const item: AppNotification = {
      ...n,
      id: uid(),
      createdAt: new Date().toISOString(),
      read: false,
      dismissed: false,
    };
    write([item, ...read()]);
    return item;
  },

  markRead(id: string): void {
    const items = read().map((n) => (n.id === id ? { ...n, read: true } : n));
    write(items);
  },

  markAllRead(): void {
    write(read().map((n) => ({ ...n, read: true })));
  },

  dismiss(id: string): void {
    write(read().filter((n) => n.id !== id));
  },

  clearAll(): void {
    write([]);
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

// Convenience: short title/message builders so callsites don't need to know
// the message shape — they just pass the kind and payload.
export function buildTxFailureNotification(
  kind: NotificationKind,
  context: NotificationContext,
  error: unknown,
): Omit<AppNotification, "id" | "createdAt" | "read" | "dismissed"> {
  const errMsg = error instanceof Error ? error.message : String(error ?? "");
  const titles: Record<NotificationKind, string> = {
    tx_create_failed: "Transaction not created",
    tx_update_failed: "Transaction not updated",
    tx_delete_failed: "Transaction not deleted",
    balance_effect_failed: "Balance update failed",
  };
  const messages: Record<NotificationKind, string> = {
    tx_create_failed:
      "The transaction couldn't be saved. The data is preserved here so you can retry.",
    tx_update_failed:
      "The transaction couldn't be updated. The changes are preserved here so you can retry.",
    tx_delete_failed:
      "The transaction couldn't be deleted. You can retry from here.",
    balance_effect_failed:
      "The transaction was saved, but its balance side-effect didn't apply. Reconcile the affected account to fix.",
  };
  return {
    severity: "error",
    kind,
    title: titles[kind],
    message: errMsg ? `${messages[kind]} (${errMsg})` : messages[kind],
    context: { ...context, error: errMsg || undefined },
  };
}
