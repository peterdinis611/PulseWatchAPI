export const CacheKeys = {
  userPublic: (userId: string): string => `user:public:${userId}`,
  monitorsPrefix: (userId: string): string => `monitors:${userId}:`,
  monitorsList: (userId: string): string => `monitors:${userId}:list`,
  monitorItem: (userId: string, id: string): string =>
    `monitors:${userId}:item:${id}`,
  notificationsPrefix: (userId: string): string => `notifications:${userId}:`,
  notificationsList: (userId: string, unreadOnly: boolean): string =>
    `notifications:${userId}:list:${unreadOnly ? 'unread' : 'all'}`,
  notificationsUnreadCount: (userId: string): string =>
    `notifications:${userId}:unreadCount`,
};
