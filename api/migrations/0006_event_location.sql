-- Event geocoded map coordinates for list thumbnails and registration maps
ALTER TABLE events ADD COLUMN latitude REAL;
ALTER TABLE events ADD COLUMN longitude REAL;
