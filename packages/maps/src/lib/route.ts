import { Coordinates } from './coordinates';

export interface Route {
  origin: Coordinates;
  destination: Coordinates;
  distanceKm: number;
  durationMinutes: number;
  polyline?: string;
  waypoints?: Coordinates[];
}

export interface RouteRequest {
  origin: Coordinates;
  destination: Coordinates;
  alternatives?: boolean;
}
