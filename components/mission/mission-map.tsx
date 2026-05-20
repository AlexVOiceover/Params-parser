"use client";

import { useEffect, useRef, useCallback } from "react";
import Map, { Marker, Source, Layer, NavigationControl, GeolocateControl } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Waypoint } from "@/lib/use-mission";
import { isNavCommand, COMMAND_DEFS } from "@/lib/mission-commands";
import { ActionIcon, actionColor } from "@/components/mission/action-icon";

const plainLineLayer = {
  id: "mission-line-plain",
  type: "line" as const,
  source: "mission-line-plain",
  paint: { "line-color": "#f59e0b", "line-width": 2, "line-opacity": 0.9 },
};

const actionLineLayer = {
  id: "mission-line-action",
  type: "line" as const,
  source: "mission-line-action",
  paint: {
    "line-color": "#6366f1",
    "line-width": 2,
    "line-opacity": 0.9,
    "line-dasharray": [4, 3],
  },
};

interface Props {
  waypoints: Waypoint[];
  selectedId: string | null;
  onMapClick: (lat: number, lon: number) => void;
  onMarkerDrag: (id: string, lat: number, lon: number) => void;
  onSelectWaypoint: (id: string) => void;
  flyToRef: React.MutableRefObject<((lat: number, lon: number) => void) | null>;
  mapboxToken: string;
  mapStyle: string;
  searchPin?: { lat: number; lon: number; label: string } | null;
}

export function MissionMap({ waypoints, selectedId, onMapClick, onMarkerDrag, onSelectWaypoint, flyToRef, mapboxToken, mapStyle, searchPin }: Props) {
  // Set token globally — required for mapbox-gl v3
  if (mapboxToken) mapboxgl.accessToken = mapboxToken;
  const mapRef = useRef<MapRef>(null);
  const isDraggingRef = useRef(false);

  // Pan to location without changing zoom
  useEffect(() => {
    flyToRef.current = (lat, lon) => {
      mapRef.current?.panTo([lon, lat], { duration: 600 });
    };
  }, [flyToRef]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = useCallback((e: any) => {
    onMapClick(e.lngLat.lat, e.lngLat.lng);
  }, [onMapClick]);

  const navWaypoints = waypoints.filter((w) => isNavCommand(w.action));

  // Build segments: for each pair of consecutive nav waypoints, collect
  // action commands that fall between them in sequence order.
  interface Segment {
    from: Waypoint;
    to: Waypoint;
    actions: Waypoint[];
  }
  const segments: Segment[] = [];
  for (let i = 0; i < navWaypoints.length - 1; i++) {
    const from = navWaypoints[i];
    const to = navWaypoints[i + 1];
    const fromSeq = from.seq;
    const toSeq = to.seq;
    const actions = waypoints.filter(
      (w) => !isNavCommand(w.action) && w.seq > fromSeq && w.seq < toSeq
    );
    segments.push({ from, to, actions });
  }

  // Orphaned actions: before the first nav waypoint or after the last.
  // Render them anchored to the nearest nav waypoint as a degenerate segment.
  const firstNav = navWaypoints[0];
  const lastNav = navWaypoints[navWaypoints.length - 1];
  if (firstNav) {
    const before = waypoints.filter(
      (w) => !isNavCommand(w.action) && w.seq < firstNav.seq
    );
    if (before.length > 0) segments.push({ from: firstNav, to: firstNav, actions: before });
  }
  if (lastNav) {
    const after = waypoints.filter(
      (w) => !isNavCommand(w.action) && w.seq > lastNav.seq
    );
    if (after.length > 0) segments.push({ from: lastNav, to: lastNav, actions: after });
  }

  // Each segment is its own 2-point LineString so we can style them independently.
  // We use MultiLineString so disconnected segments render in one Source.
  const plainSegmentCoords = segments
    .filter((s) => s.actions.length === 0 && s.from.id !== s.to.id)
    .map((s) => [[s.from.lon, s.from.lat], [s.to.lon, s.to.lat]]);

  const actionSegmentCoords = segments
    .filter((s) => s.actions.length > 0 && s.from.id !== s.to.id)
    .map((s) => {
      const pts: number[][] = [[s.from.lon, s.from.lat]];
      s.actions.forEach((action, idx) => {
        const t = (idx + 1) / (s.actions.length + 1);
        const computedLat = s.from.lat + t * (s.to.lat - s.from.lat);
        const computedLon = s.from.lon + t * (s.to.lon - s.from.lon);
        const lat = action.lat !== 0 ? action.lat : computedLat;
        const lon = action.lon !== 0 ? action.lon : computedLon;
        pts.push([lon, lat]);
      });
      pts.push([s.to.lon, s.to.lat]);
      return pts;
    });

  const makeMultiLine = (coords: number[][][]): GeoJSON.Feature<GeoJSON.MultiLineString> => ({
    type: "Feature", properties: {},
    geometry: { type: "MultiLineString", coordinates: coords },
  });

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={mapboxToken}
      initialViewState={{ longitude: -0.09, latitude: 51.505, zoom: 13 }}
      style={{ width: "100%", height: "100%" }}
      mapStyle={mapStyle}
      onClick={handleClick}
      cursor="crosshair"
    >
      <NavigationControl position="top-right" />
      <GeolocateControl
        position="top-right"
        trackUserLocation
        showUserHeading
        fitBoundsOptions={{ maxZoom: 18 }}
      />

      {/* Plain segments — solid amber */}
      {plainSegmentCoords.length > 0 && (
        <Source id="mission-line-plain" type="geojson" data={makeMultiLine(plainSegmentCoords)}>
          <Layer {...plainLineLayer} />
        </Source>
      )}
      {/* Action segments — dashed indigo */}
      {actionSegmentCoords.length > 0 && (
        <Source id="mission-line-action" type="geojson" data={makeMultiLine(actionSegmentCoords)}>
          <Layer {...actionLineLayer} />
        </Source>
      )}

      {/* Search result pin */}
      {searchPin && (
        <Marker longitude={searchPin.lon} latitude={searchPin.lat} anchor="bottom">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", pointerEvents: "none" }}>
            <div style={{
              background: "white", color: "#111", fontSize: 11, fontWeight: 600,
              padding: "3px 8px", borderRadius: 6, boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              whiteSpace: "nowrap", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis",
              marginBottom: 4,
            }}>
              {searchPin.label}
            </div>
            <div style={{
              width: 14, height: 14, borderRadius: "50% 50% 50% 0", background: "#2563eb",
              border: "2px solid white", transform: "rotate(-45deg)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
            }} />
          </div>
        </Marker>
      )}

      {/* Nav waypoint markers — badge above, stem pointing to exact coordinate */}
      {waypoints.filter((w) => isNavCommand(w.action)).map((w) => (
        <Marker
          key={w.id}
          longitude={w.lon}
          latitude={w.lat}
          anchor="bottom"
          draggable
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onDrag={(e: any) => { isDraggingRef.current = true; onMarkerDrag(w.id, e.lngLat.lat, e.lngLat.lng); }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onDragEnd={(e: any) => { onMarkerDrag(w.id, e.lngLat.lat, e.lngLat.lng); setTimeout(() => { isDraggingRef.current = false; }, 100); }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={(e: any) => { e.originalEvent.stopPropagation(); if (!isDraggingRef.current) onSelectWaypoint(w.id); }}
        >
          {(() => {
            const base = actionColor(w.action);
            const bg = w.id === selectedId ? "#2563eb" : base;
            return (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}>
                <div style={{ position: "relative" }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: bg, border: "2.5px solid white",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white",
                  }}>
                    <ActionIcon action={w.action} size={15} />
                  </div>
                  <div style={{
                    position: "absolute", bottom: -3, right: -5,
                    minWidth: 16, height: 16, borderRadius: 8,
                    background: "white", border: `2px solid ${bg}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 800, color: bg, fontFamily: "monospace",
                    padding: "0 2px", lineHeight: 1,
                  }}>
                    {w.seq}
                  </div>
                </div>
                <div style={{ width: 2, height: 8, background: bg, borderRadius: "0 0 2px 2px" }} />
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: bg, border: "1.5px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.5)" }} />
              </div>
            );
          })()}
        </Marker>
      ))}

      {/* Non-nav action badges — position derived from sequence, with manual drag override */}
      {waypoints.filter((w) => !isNavCommand(w.action)).map((action) => {
        // Find surrounding nav waypoints by sequence
        const prevNav = [...navWaypoints].reverse().find((n) => n.seq < action.seq);
        const nextNav = navWaypoints.find((n) => n.seq > action.seq);
        const anchorNav = prevNav ?? nextNav;
        if (!anchorNav) return null;

        // Compute interpolated position on the segment (or anchor point if orphaned)
        let computedLat: number, computedLon: number;
        if (prevNav && nextNav) {
          // Count siblings in this segment for even spacing
          const siblings = waypoints.filter(
            (w) => !isNavCommand(w.action) && w.seq > prevNav.seq && w.seq < nextNav.seq
          );
          const posIdx = siblings.findIndex((w) => w.id === action.id);
          const t = (posIdx + 1) / (siblings.length + 1);
          computedLat = prevNav.lat + t * (nextNav.lat - prevNav.lat);
          computedLon = prevNav.lon + t * (nextNav.lon - prevNav.lon);
        } else {
          computedLat = anchorNav.lat;
          computedLon = anchorNav.lon;
        }

        // Use manually dragged position if set, otherwise computed position
        const finalLat = action.lat !== 0 ? action.lat : computedLat;
        const finalLon = action.lon !== 0 ? action.lon : computedLon;

        {
          const label = COMMAND_DEFS[action.action]?.label ?? action.action.replace(/_/g, " ");
          const isSelected = action.id === selectedId;
          const base = actionColor(action.action);
          const color = isSelected ? "#2563eb" : base;
          return (
            <Marker key={action.id} longitude={finalLon} latitude={finalLat} anchor="bottom"
              draggable
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onDrag={(e: any) => { isDraggingRef.current = true; onMarkerDrag(action.id, e.lngLat.lat, e.lngLat.lng); }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onDragEnd={(e: any) => { onMarkerDrag(action.id, e.lngLat.lat, e.lngLat.lng); setTimeout(() => { isDraggingRef.current = false; }, 100); }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={(e: any) => { e.originalEvent.stopPropagation(); if (!isDraggingRef.current) onSelectWaypoint(action.id); }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }} title={label}>
                <div style={{ position: "relative" }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: color, border: "2.5px solid white",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white",
                  }}>
                    <ActionIcon action={action.action} size={13} />
                  </div>
                  {/* Seq badge — small, white ring */}
                  <div style={{
                    position: "absolute", top: -5, left: -5,
                    width: 14, height: 14, borderRadius: "50%",
                    background: "white", border: `2px solid ${color}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, fontWeight: 700, color: color, fontFamily: "monospace",
                  }}>
                    {action.seq}
                  </div>
                </div>
                <div style={{ width: 2, height: 8, background: color, borderRadius: "0 0 2px 2px" }} />
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, border: "1.5px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.5)" }} />
              </div>
            </Marker>
          );
        }
      })}
    </Map>
  );
}
