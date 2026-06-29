import { SupabaseClient } from '@supabase/supabase-js';

export interface CreateNotificationRequest {
  tenantId: string;
  recipientId: string;
  rideRequestId?: string;
  channel?: 'in_app' | 'push' | 'sms' | 'whatsapp' | 'email';
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export class NotificationsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listUnread(recipientId: string) {
    return this.supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', recipientId)
      .neq('status', 'read')
      .order('created_at', { ascending: false });
  }

  async countUnread(recipientId: string) {
    return this.supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', recipientId)
      .neq('status', 'read');
  }

  async create(request: CreateNotificationRequest) {
    return this.supabase.from('notifications').insert({
      tenant_id: request.tenantId,
      recipient_id: request.recipientId,
      ride_request_id: request.rideRequestId ?? null,
      channel: request.channel ?? 'in_app',
      status: 'queued',
      title: request.title,
      body: request.body,
      data: request.data ?? {}
    });
  }

  async markRead(notificationId: string) {
    return this.supabase
      .from('notifications')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('id', notificationId);
  }

  async markAllRead(recipientId: string) {
    return this.supabase
      .from('notifications')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('recipient_id', recipientId)
      .neq('status', 'read');
  }

  async notifyDriverAssigned(tenantId: string, driverProfileId: string, rideRequestId: string, pickupAddress: string) {
    return this.create({
      tenantId,
      recipientId: driverProfileId,
      rideRequestId,
      channel: 'in_app',
      title: 'Nuevo viaje asignado',
      body: `Recogida: ${pickupAddress}`,
      data: { rideRequestId, event: 'driver_assigned' }
    });
  }

  async notifyRideStatusChanged(tenantId: string, recipientId: string, rideRequestId: string, newStatus: string) {
    const labels: Record<string, string> = {
      arriving: 'Tu chofer va en camino',
      in_progress: 'Viaje en curso',
      completed: 'Viaje completado',
      cancelled: 'Viaje cancelado'
    };

    return this.create({
      tenantId,
      recipientId,
      rideRequestId,
      channel: 'in_app',
      title: labels[newStatus] ?? 'Actualizacion del viaje',
      body: `Estado: ${newStatus}`,
      data: { rideRequestId, event: newStatus }
    });
  }
}
