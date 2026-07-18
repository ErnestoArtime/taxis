import { Component, ElementRef, Input, OnInit, ViewChild, inject } from '@angular/core';
import { NominatimMapProvider } from '@taxi/maps';
import type { Coordinates } from '@taxi/maps';

@Component({
  selector: 'app-map-view',
  standalone: true,
  template: `<div #mapContainer class="map-container"></div>`,
  styles: [`
    .map-container { width: 100%; height: 100%; min-height: 220px; border-radius: 8px; }
  `]
})
export class MapViewComponent implements OnInit {
  @ViewChild('mapContainer', { static: true }) container!: ElementRef<HTMLDivElement>;
  @Input() originAddress = '';
  @Input() destinationAddress = '';
  @Input() originCoords: Coordinates | null = null;
  @Input() destinationCoords: Coordinates | null = null;
  @Input() interactive = true;
  @Input() zoom = 14;

  private mapsProvider = new NominatimMapProvider();
  private map: any = null;
  private L: any = null;

  async ngOnInit(): Promise<void> {
    await this.loadLeaflet();
    this.initMap();
  }

  private async loadLeaflet(): Promise<void> {
    if ((window as any).L) {
      this.L = (window as any).L;
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    return new Promise<void>((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => {
        this.L = (window as any).L;
        resolve();
      };
      document.body.appendChild(script);
    });
  }

  private async initMap(): Promise<void> {
    if (!this.L) return;

    let origin = this.originCoords;
    let destination = this.destinationCoords;

    if (!origin && this.originAddress) {
      origin = (await this.mapsProvider.geocode(this.originAddress))?.coordinates ?? null;
    }
    if (!destination && this.destinationAddress) {
      destination = (await this.mapsProvider.geocode(this.destinationAddress))?.coordinates ?? null;
    }

    const center = origin ?? destination ?? { lat: 23.1136, lng: -82.3666 };
    this.map = this.L.map(this.container.nativeElement, {
      center: [center.lat, center.lng],
      zoom: this.zoom,
      zoomControl: this.interactive,
      dragging: this.interactive
    });

    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);

    const markers: any[] = [];

    if (origin) {
      const icon = this.L.divIcon({
        className: 'custom-marker pickup-marker',
        html: '<div style="background:#10b981;color:#fff;padding:4px 8px;border-radius:4px;font-size:12px;font-weight:700">Salida</div>',
        iconSize: [60, 24],
        iconAnchor: [30, 12]
      });
      markers.push(this.L.marker([origin.lat, origin.lng], { icon }).addTo(this.map));
    }

    if (destination) {
      const icon = this.L.divIcon({
        className: 'custom-marker dropoff-marker',
        html: '<div style="background:#6366f1;color:#fff;padding:4px 8px;border-radius:4px;font-size:12px;font-weight:700">Destino</div>',
        iconSize: [60, 24],
        iconAnchor: [30, 12]
      });
      markers.push(this.L.marker([destination.lat, destination.lng], { icon }).addTo(this.map));
    }

    if (origin && destination) {
      const route = await this.mapsProvider.getRoute({ origin, destination });
      if (route?.polyline) {
        try {
          const geometry = JSON.parse(route.polyline);
          if (geometry?.coordinates) {
            const latlngs = geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
            this.L.polyline(latlngs, { color: '#6366f1', weight: 4, opacity: 0.8 }).addTo(this.map);
          }
        } catch { /* polyline parse failed, skip */ }
      }

      if (markers.length >= 2) {
        const group = this.L.featureGroup(markers);
        this.map.fitBounds(group.getBounds().pad(0.15));
      }
    }

    setTimeout(() => this.map?.invalidateSize(), 300);
  }
}
