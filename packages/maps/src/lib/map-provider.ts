import { Coordinates, Place } from './coordinates';
import { Route, RouteRequest } from './route';

export interface MapProvider {
  geocode(address: string): Promise<Place | null>;
  reverseGeocode(coordinates: Coordinates): Promise<Place | null>;
  getRoute(request: RouteRequest): Promise<Route | null>;
  getDistanceKm(origin: Coordinates, destination: Coordinates): Promise<number>;
  getDurationMinutes(origin: Coordinates, destination: Coordinates): Promise<number>;
}

export type MapProviderType = 'leaflet' | 'mapbox' | 'google';
