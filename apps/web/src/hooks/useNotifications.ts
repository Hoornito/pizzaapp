'use client';

import { useNotificationStore } from '@/store/notificationStore';

export function useNotifications() {
  const store = useNotificationStore();
  return {
    notifications: store.notifications,
    unreadCount: store.unreadCount,
    markRead: store.markRead,
    markAllRead: store.markAllRead,
    clearAll: store.clearAll,
  };
}
