import L from 'leaflet';

// Fix default marker icon (Leaflet + bundlers issue)
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

export const defaultIcon = L.icon({
  iconUrl: (iconUrl as unknown as { src: string }).src || (iconUrl as unknown as string),
  iconRetinaUrl: (iconRetinaUrl as unknown as { src: string }).src || (iconRetinaUrl as unknown as string),
  shadowUrl: (shadowUrl as unknown as { src: string }).src || (shadowUrl as unknown as string),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
