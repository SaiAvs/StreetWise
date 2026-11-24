import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import type { Complaint } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';

const PRIORITY_COLORS: Record<string, string> = {
  low: '#64748b',
  medium: '#4E956C',
  high: '#ea580c',
  urgent: '#dc2626',
};

function makeIcon(priority: string): L.DivIcon {
  const color = PRIORITY_COLORS[priority] ?? '#64748b';
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${color};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

interface MapViewProps {
  complaints: Pick<Complaint, 'id' | 'reference_number' | 'title' | 'status' | 'priority' | 'latitude' | 'longitude'>[];
  center?: [number, number];
  zoom?: number;
  className?: string;
  onPick?: (lat: number, lng: number) => void;
  cursorMarker?: [number, number] | null;
}

export default function MapView({
  complaints, center, zoom = 12, className = 'h-80', onPick, cursorMarker,
}: MapViewProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  const computedCenter = useMemo<[number, number]>(() => {
    if (center) return center;
    if (complaints.length > 0) {
      const lat = complaints.reduce((s, c) => s + c.latitude, 0) / complaints.length;
      const lng = complaints.reduce((s, c) => s + c.longitude, 0) / complaints.length;
      return [lat, lng];
    }
    return [20.5937, 78.9629]; // India centroid as neutral default
  }, [center, complaints]);

  // init map once
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { center: computedCenter, zoom, scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    if (onPick) {
      map.on('click', (e: L.LeafletMouseEvent) => pickRef.current?.(e.latlng.lat, e.latlng.lng));
    }
    // ensure tiles render after layout settles
    setTimeout(() => map.invalidateSize(), 150);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // markers
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    if (!onPick && complaints.length > 0) {
      const group = L.markerClusterGroup();
      for (const c of complaints) {
        const m = L.marker([c.latitude, c.longitude], { icon: makeIcon(c.priority) });
        m.bindPopup(
          `<strong>${c.reference_number}</strong><br/>${c.title}<br/><em>${STATUS_LABELS[c.status]}</em>`
        );
        group.addLayer(m);
      }
      layer.addLayer(group);
      const bounds = group.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.2), { maxZoom: 15 });
    } else if (onPick) {
      for (const c of complaints) {
        L.marker([c.latitude, c.longitude], { icon: makeIcon(c.priority) }).addTo(layer);
      }
    }
  }, [complaints, onPick]);

  // cursor marker for location picking
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onPick) return;
    if (cursorMarker) {
      L.marker(cursorMarker).addTo(layerRef.current!);
    }
  }, [cursorMarker, onPick]);

  return <div ref={elRef} className={`${className} w-full`} />;
}
