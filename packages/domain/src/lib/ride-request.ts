export interface RideRequest {
  id: string;
  tenant_id: string;
  customer_id: string;
  driver_id?: string;
  vehicle_id?: string;
  service_area_id?: string;
  vehicle_class_id?: string;
  pickup_address: string;
  dropoff_address?: string;
  pickup_lat?: number;
  pickup_lng?: number;
  dropoff_lat?: number;
  dropoff_lng?: number;
  pickup_at: string;
  passenger_count: number;
  estimated_distance_km?: number;
  estimated_duration_minutes?: number;
  notes?: string;
  status: string;
  estimated_price?: number;
  final_price?: number;
  created_at: string;
  updated_at: string;
}
