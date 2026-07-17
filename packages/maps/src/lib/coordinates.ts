export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Place {
  coordinates: Coordinates;
  address: string;
  reference?: string;
}
