export type NotificationChannel = 'in_app' | 'push' | 'sms' | 'whatsapp' | 'email';
export type NotificationStatus = 'queued' | 'sent' | 'read' | 'failed';

export interface NotificationMessage {
  id: string;
  tenantId: string;
  recipientId: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  createdAt: string;
}
