import { useSyncExternalStore } from "react";
import { notificationsStore, type AppNotification } from "@/lib/notifications";

function subscribe(listener: () => void) {
  return notificationsStore.subscribe(() => listener());
}

function getSnapshot(): AppNotification[] {
  return notificationsStore.list();
}

export function useNotifications() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const unreadCount = items.filter((n) => !n.read && !n.dismissed).length;
  return {
    items,
    unreadCount,
    markRead: notificationsStore.markRead,
    markAllRead: notificationsStore.markAllRead,
    dismiss: notificationsStore.dismiss,
    clearAll: notificationsStore.clearAll,
  };
}
