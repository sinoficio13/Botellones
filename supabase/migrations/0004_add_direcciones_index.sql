-- Index for spatial queries: finding clients with coordinates for the map
CREATE INDEX idx_direcciones_coords ON direcciones (latitud, longitud)
WHERE latitud IS NOT NULL
  AND longitud IS NOT NULL;
