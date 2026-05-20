"use client";

import dynamic from "next/dynamic";
import { useRef, useState, useEffect } from "react";
import { ChevronUp, ChevronDown, Trash2, X, Navigation, Save, FolderOpen, Undo2 } from "lucide-react";
import { ActionIcon, actionColor } from "@/components/mission/action-icon";
import { useMission, type WaypointAction } from "@/lib/use-mission";
import { WaypointParams } from "@/components/mission/waypoint-params";
import { isNavCommand, COMMAND_DEFS } from "@/lib/mission-commands";
import { downloadWaypointsFile, parseWaypointsFile } from "@/lib/mission-file";
import { validateMission } from "@/lib/mission-validation";
import { AlertTriangle, AlertCircle } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

const SearchBox = dynamic(
  () => import("@mapbox/search-js-react").then((m) => m.SearchBox),
  { ssr: false }
);

// react-map-gl uses WebGL — must be client only
const MissionMap = dynamic(
  () => import("@/components/mission/mission-map").then((m) => m.MissionMap),
  { ssr: false, loading: () => <div className="h-full w-full bg-secondary/30 flex items-center justify-center text-muted-foreground text-sm">Loading map…</div> }
);

// Group actions for the dropdown
const ACTION_GROUPS: { label: string; actions: WaypointAction[] }[] = [
  { label: "Navigation", actions: ["WAYPOINT", "TAKEOFF", "LAND", "RETURN_TO_LAUNCH", "SPLINE_WAYPOINT", "LOITER_TIME", "LOITER_TURNS", "LOITER_UNLIM", "DO_LAND_START"] },
  { label: "Speed & Control", actions: ["DO_CHANGE_SPEED", "DO_JUMP", "JUMP_TAG", "DO_JUMP_TAG", "DELAY", "CONDITION_DELAY", "CONDITION_DISTANCE", "CONDITION_YAW", "DO_GUIDED_LIMITS", "GUIDED_ENABLE"] },
  { label: "Camera", actions: ["IMAGE_START_CAPTURE", "IMAGE_STOP_CAPTURE", "VIDEO_START_CAPTURE", "VIDEO_STOP_CAPTURE", "SET_CAMERA_ZOOM", "SET_CAMERA_FOCUS", "SET_CAMERA_SOURCE", "DO_DIGICAM_CONFIGURE", "DO_DIGICAM_CONTROL", "DO_SET_CAM_TRIGG_DIST"] },
  { label: "Gimbal & Mount", actions: ["DO_MOUNT_CONTROL", "DO_GIMBAL_MANAGER_PITCHYAW", "DO_SET_ROI", "DO_SET_ROI_LOCATION", "DO_SET_ROI_NONE"] },
  { label: "Payload", actions: ["PAYLOAD_PLACE", "DO_GRIPPER", "DO_SPRAYER", "DO_WINCH", "DO_PARACHUTE"] },
  { label: "Servo & Relay", actions: ["DO_SET_SERVO", "DO_REPEAT_SERVO", "DO_SET_RELAY", "DO_REPEAT_RELAY"] },
  { label: "Mission Control", actions: ["DO_SET_HOME", "DO_SET_RESUME_REPEAT_DIST", "ATTITUDE_TIME", "DO_ENGINE_CONTROL", "DO_AUX_FUNCTION"] },
  { label: "Scripting", actions: ["SCRIPT_TIME", "DO_SEND_SCRIPT_MESSAGE"] },
  { label: "Other", actions: ["UNKNOWN"] },
];

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

function SortableCard({ id, isNav, isSelected, onClick, children }: {
  id: string; isNav: boolean; isSelected: boolean;
  onClick: () => void; children: React.ReactNode;
}) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({ id });

  // Expose drag handle props via context so the handle button inside can use them
  // without calling useSortable again (calling it twice with the same id breaks dnd-kit).
  return (
    <DragHandleContext.Provider value={{ attributes, listeners }}>
      <div
        ref={setNodeRef}
        onClick={onClick}
        style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
        className={`mx-2 my-1.5 rounded-lg border overflow-hidden cursor-pointer ${
          isSelected
            ? isNav ? "border-amber-500/60 bg-amber-500/5" : "border-indigo-500/60 bg-indigo-500/5"
            : "border-border bg-card"
        } ${isDragging ? "shadow-lg z-50" : ""}`}
      >
        {children}
      </div>
    </DragHandleContext.Provider>
  );
}

import { createContext, useContext } from "react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DragHandleContext = createContext<{ attributes: any; listeners: any } | null>(null);

function SortableDragHandle({ id: _id }: { id: string }) {
  const ctx = useContext(DragHandleContext);
  if (!ctx) return null;
  return (
    <button
      {...ctx.attributes}
      {...ctx.listeners}
      onClick={(e) => e.stopPropagation()}
      className="rounded p-1 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 touch-none"
      title="Drag to reorder"
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  );
}


const MAP_STYLES = [
  { id: "mapbox://styles/mapbox/standard",              label: "Standard 3D" },
  { id: "mapbox://styles/mapbox/satellite-streets-v12", label: "Satellite" },
  { id: "mapbox://styles/mapbox/streets-v12",           label: "Streets" },
  { id: "mapbox://styles/mapbox/outdoors-v12",          label: "Outdoors" },
  { id: "mapbox://styles/mapbox/dark-v11",              label: "Dark" },
] as const;

type MapStyleId = typeof MAP_STYLES[number]["id"];

export default function MissionPage() {
  const { waypoints, addWaypoint, updateWaypoint, removeWaypoint, moveUp, moveDown, clearAll, reorderById, loadWaypoints, undo, canUndo } = useMission();
  const validationWarnings = validateMission(waypoints);
  const warningById = new Map(validationWarnings.map((w) => [w.waypointId, w]));
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSave() {
    downloadWaypointsFile(waypoints, "mission.waypoints");
  }

  function handleLoadClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const wps = parseWaypointsFile(text);
      loadWaypoints(wps);
    } catch (err) {
      alert(`Could not load file: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    e.target.value = "";
  }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Ctrl+Z / Cmd+Z to undo
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderById(String(active.id), String(over.id));
    }
  }
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyleId>("mapbox://styles/mapbox/standard");
  const [expertMode, setExpertMode] = useState(false);
  const [searchPin, setSearchPin] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const flyToRef = useRef<((lat: number, lon: number) => void) | null>(null);

  function handleMapClick(lat: number, lon: number) {
    setSearchPin(null); // clear search pin when user clicks to add a waypoint
    addWaypoint(lat, lon);
  }

  function getDisplayPosition(id: string): { lat: number; lon: number } | null {
    const wp = waypoints.find((w) => w.id === id);
    if (!wp) return null;
    if (isNavCommand(wp.action)) return { lat: wp.lat, lon: wp.lon };
    // For action commands, compute the same t-fraction position used to render the badge
    const idx = waypoints.indexOf(wp);
    const prev = [...waypoints].slice(0, idx).reverse().find((p) => isNavCommand(p.action));
    const next = [...waypoints].slice(idx + 1).find((p) => isNavCommand(p.action));
    if (!prev || !next) return null;
    // Count all action commands in this same segment and find this one's index
    const siblingsInSegment = waypoints.filter(
      (w) => !isNavCommand(w.action) && w.seq > prev.seq && w.seq < next.seq
    );
    const posIdx = siblingsInSegment.findIndex((w) => w.id === id);
    const t = (posIdx + 1) / (siblingsInSegment.length + 1);
    return {
      lat: prev.lat + t * (next.lat - prev.lat),
      lon: prev.lon + t * (next.lon - prev.lon),
    };
  }

  function handleSelectWaypoint(id: string) {
    setSelectedId(id);
    const pos = getDisplayPosition(id);
    if (pos) flyToRef.current?.(pos.lat, pos.lon);
  }

  function handleRowClick(id: string) {
    setSelectedId(id);
    const pos = getDisplayPosition(id);
    if (pos) flyToRef.current?.(pos.lat, pos.lon);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-toolbar shrink-0 flex-wrap">
        <div className="flex items-center gap-2 shrink-0">
          <Navigation className="h-4 w-4 text-primary" />
          <h1 className="text-sm font-semibold text-foreground">Mission</h1>
          {waypoints.length > 0 && (
            <span className="text-xs text-muted-foreground">{waypoints.length} wp</span>
          )}
        </div>
        {/* Mapbox search */}
        <div className="flex-1 min-w-0 max-w-sm">
          <SearchBox
            accessToken={MAPBOX_TOKEN}
            onRetrieve={(res) => {
              const f = res.features[0];
              const [lon, lat] = f.geometry.coordinates;
              const label = f.properties?.name ?? f.properties?.full_address ?? "Search result";
              setSearchPin({ lat, lon, label });
              flyToRef.current?.(lat, lon);
            }}
            options={{ language: "en", limit: 8 }}
            placeholder="Search location…"
            theme={{
              variables: {
                fontFamily: "inherit",
                unit: "12px",
                padding: "0.4em 0.8em",
                borderRadius: "6px",
              },
            }}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={mapStyle}
            onChange={(e) => setMapStyle(e.target.value as MapStyleId)}
            className="rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-foreground outline-none cursor-pointer"
          >
            {MAP_STYLES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleLoadClick}
            title="Load .waypoints file"
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Load</span>
          </button>
          {waypoints.length > 0 && (
            <>
              <button
                onClick={handleSave}
                title="Save as .waypoints file"
                className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Save className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Save</span>
              </button>
              <button onClick={clearAll} className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors cursor-pointer whitespace-nowrap">
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept=".waypoints,.txt" className="hidden" onChange={handleFileChange} />
      </div>

      {/* Body: map + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          {waypoints.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="bg-card/90 border border-border rounded-lg px-4 py-3 text-center shadow-lg">
                <p className="text-sm font-medium text-foreground">Click the map to add waypoints</p>
                <p className="text-xs text-muted-foreground mt-0.5">First waypoint will be set as Takeoff</p>
              </div>
            </div>
          )}
          <MissionMap
            waypoints={waypoints}
            selectedId={selectedId}
            onMapClick={handleMapClick}
            onMarkerDrag={(id, lat, lon) => updateWaypoint(id, { lat, lon })}
            onSelectWaypoint={handleSelectWaypoint}
            flyToRef={flyToRef}
            mapboxToken={MAPBOX_TOKEN}
            mapStyle={mapStyle}
            searchPin={searchPin}
          />
        </div>

        {/* Sidebar */}
        {waypoints.length > 0 && (
          <div className="w-72 shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-border shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Waypoints</p>
                {validationWarnings.some(w => w.type === "error") && (
                  <span className="flex items-center gap-1 text-[10px] text-destructive font-medium">
                    <AlertCircle className="h-3 w-3" />
                    {validationWarnings.filter(w => w.type === "error").length} error{validationWarnings.filter(w => w.type === "error").length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={expertMode}
                  onChange={(e) => setExpertMode(e.target.checked)}
                  className="h-3 w-3 cursor-pointer accent-primary"
                />
                <span className="text-[11px] text-muted-foreground">Expert</span>
              </label>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={waypoints.map(w => w.id)} strategy={verticalListSortingStrategy}>
              {waypoints.map((w) => {
                const isNav = isNavCommand(w.action);
                const cmdLabel = COMMAND_DEFS[w.action]?.label ?? w.action.replace(/_/g, " ");
                return (
                <SortableCard key={w.id} id={w.id} isNav={isNav} isSelected={w.id === selectedId}
                  onClick={() => handleRowClick(w.id)}>
                <div className={`px-3 py-2.5 cursor-pointer transition-colors ${isNav ? "hover:bg-amber-500/5" : "hover:bg-indigo-500/5"}`}>
                  {/* Row 1: badge + action dropdown + alt + controls */}
                  <div className="flex items-center gap-2">
                    {/* Icon + seq merged into one pill */}
                    <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg shrink-0 text-white" style={{ background: actionColor(w.action) }}>
                      <ActionIcon action={w.action} size={12} />
                      <span className="text-[10px] font-bold font-mono leading-none">{w.seq}</span>
                    </div>

                    {/* Validation warning */}
                    {warningById.has(w.id) && (() => {
                      const warn = warningById.get(w.id)!;
                      return (
                        <span title={warn.message} className="shrink-0 cursor-help">
                          {warn.type === "error"
                            ? <AlertCircle className="h-4 w-4 text-destructive" />
                            : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                        </span>
                      );
                    })()}

                    {/* Action dropdown — full width */}
                    <select
                      value={w.action}
                      onChange={(e) => updateWaypoint(w.id, { action: e.target.value as WaypointAction })}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 min-w-0 rounded-md border border-border bg-secondary px-2 py-1.5 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                    >
                      {ACTION_GROUPS.map((g) => (
                        <optgroup key={g.label} label={g.label}>
                          {g.actions.map((a) => (
                            <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>

                    {/* Altitude — nav only */}
                    {isNav && (
                      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          value={w.alt}
                          min={0}
                          max={500}
                          onChange={(e) => updateWaypoint(w.id, { alt: parseFloat(e.target.value) || 0 })}
                          className="w-14 rounded-md border border-border bg-secondary px-1.5 py-1.5 text-xs text-foreground text-right outline-none focus:ring-1 focus:ring-ring"
                        />
                        <span className="text-[10px] text-muted-foreground">m</span>
                      </div>
                    )}

                    {/* Delete + drag handle */}
                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeWaypoint(w.id); if (selectedId === w.id) setSelectedId(null); }}
                        className="rounded p-1 text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <SortableDragHandle id={w.id} />
                    </div>
                  </div>
                </div>
                <WaypointParams
                  action={w.action}
                  params={w.params ?? {}}
                  onChange={(key, val) => updateWaypoint(w.id, { params: { ...w.params, [key]: val } })}
                  expertMode={expertMode}
                />
                </SortableCard>
                );
              })}
              </SortableContext>
              </DndContext>
            </div>
            {/* Summary footer */}
            <div className="px-3 py-2 border-t border-border shrink-0 text-[11px] text-muted-foreground">
              {waypoints.filter(w => isNavCommand(w.action)).length} nav · {waypoints.filter(w => !isNavCommand(w.action)).length} actions
              {waypoints.some(w => isNavCommand(w.action)) && ` · max alt ${Math.max(...waypoints.filter(w => isNavCommand(w.action)).map(w => w.alt))}m`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
