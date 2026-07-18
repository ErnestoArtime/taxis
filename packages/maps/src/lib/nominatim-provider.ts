import { MapProvider } from './map-provider';
import { Coordinates, Place } from './coordinates';
import { Route, RouteRequest } from './route';

export class NominatimMapProvider implements MapProvider {
  private userAgent: string;

  constructor(appName = 'TaxiPlatform/0.1') {
    this.userAgent = appName;
  }

  async geocode(address: string): Promise<Place | null> {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': this.userAgent } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.length === 0) return null;
    return {
      coordinates: { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) },
      address: data[0].display_name
    };
  }

  async reverseGeocode(coordinates: Coordinates): Promise<Place | null> {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coordinates.lat}&lon=${coordinates.lng}`;
    const res = await fetch(url, { headers: { 'User-Agent': this.userAgent } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.display_name) return null;
    return {
      coordinates,
      address: data.display_name
    };
  }

  async getRoute(request: RouteRequest): Promise<Route | null> {
    const url =
      `https://router.project-osrm.org/route/v1/driving/${request.origin.lng},${request.origin.lat};${request.destination.lng},${request.destination.lat}?overview=full&geometries=geojson&steps=false`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.routes || data.routes.length === 0) return null;
    const route = data.routes[0];
    return {
      origin: request.origin,
      destination: request.destination,
      distanceKm: Math.round(route.distance / 1000 * 100) / 100,
      durationMinutes: Math.round(route.duration / 60),
      polyline: JSON.stringify(route.geometry)
    };
  }

  async getDistanceKm(origin: Coordinates, destination: Coordinates): Promise<number> {
    const route = await this.getRoute({ origin, destination });
    return route?.distanceKm ?? this.haversine(origin, destination);
  }

  async getDurationMinutes(origin: Coordinates, destination: Coordinates): Promise<number> {
    const route = await this.getRoute({ origin, destination });
    return route?.durationMinutes ?? 0;
  }

  private haversine(a: Coordinates, b: Coordinates): number {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const a2 = sinDLat * sinDLat + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinDLng * sinDLng;
    return R * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2));
  }
}
