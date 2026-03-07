Main page, hide protected if not in use. Icon to collapse like a side panel?

Installable app? log on the console last time params fetched

---

# Plan: Compare Params Feature

## Overview
Add a "Compare" button to the catalog header that opens a two-step flow:
1. **Version selector** — folder tree (drone types → param sets → versions with checkboxes)
2. **Compare table** — frozen param name column, one column per selected version, diff highlighting, invalid value styling, filter for diffs only

---

## Route Structure

```
app/catalog/compare/
└── page.tsx     — handles both selection and results via URL search params
```

URL shape:
- `/catalog/compare` — empty selection state (show version tree)
- `/catalog/compare?v=<id>&v=<id>&v=<id>` — comparison state (show table)

Transition: selecting versions and clicking "Compare" does a client-side `router.push` with the `?v=` params. The back button returns to the tree.

---

## New Files

### 1. `app/catalog/compare/page.tsx` (server component)
- If `?v=` params present → fetch compare data server-side, render `<CompareTable>`
- If no `?v=` params → fetch drone/paramset/version hierarchy, render `<VersionTree>`
- Both states live in the same page to keep navigation shallow

### 2. `app/api/catalog/compare/route.ts`
`GET /api/catalog/compare?v=id1&v=id2&v=id3`

Fetches (using `createClient()` — respects RLS):
- Joins `param_values` → `param_versions` → `param_sets` → `drone_types`
- Filters by the given version IDs

Response shape:
```typescript
{
  versions: { id: string; label: string; paramSetName: string; droneName: string }[];
  rows: { name: string; values: Record<string /* versionId */, string> }[];
}
```

### 3. `components/compare/version-tree.tsx` (client component)
- Renders collapsible folder tree: DroneType → ParamSet → versions
- Each version row has a checkbox + version label + "latest" badge
- Selected count shown in sticky footer: "2 selected — Compare →" button (enabled at 2+)
- On click: `router.push('/catalog/compare?v=id1&v=id2')`
- Receives pre-fetched tree data as props (no client-side fetch)

Data shape passed as props:
```typescript
{
  droneTypes: {
    id: string; name: string; slug: string;
    paramSets: {
      id: string; name: string;
      versions: { id: string; label: string; isLatest: boolean }[];
    }[];
  }[];
}
```

### 4. `components/compare/compare-table.tsx` (client component)
- Table with frozen first column (param name), one column per version, horizontal scroll
- Version column headers show: drone name / param set name / version label
- Diff detection: a row is "different" if not all present values are identical
- Cell styling:
  - **Differing value**: `bg-amber-400/15 text-amber-200` (highlight)
  - **Missing in this version**: `text-muted-foreground italic` — show "—"
  - **Invalid value**: `bg-destructive/20 text-destructive-foreground` (reuse `validateParam` from `lib/param-engine.ts`)
- Filter toggle button: "Show differences only" — hides rows where all values are equal
- Param definitions fetched from `/api/param-definitions` on mount for validation

---

## Entry Point: Catalog Header Button

In `app/catalog/layout.tsx`, add a "Compare" link button alongside the existing header buttons:
```tsx
<Link href="/catalog/compare" className="...">
  <Columns2 className="h-3.5 w-3.5" />
  Compare
</Link>
```
Use `Columns2` from lucide-react.

---

## Implementation Steps

1. **API route** — `app/api/catalog/compare/route.ts`
   - Query `param_values` joined with version/set/drone metadata for given version IDs
   - Return structured JSON

2. **Compare page** — `app/catalog/compare/page.tsx`
   - Branch on `searchParams.v`
   - Selection branch: fetch full drone→paramset→version hierarchy server-side, render `<VersionTree>`
   - Results branch: server-side fetch compare API data, render `<CompareTable>`

3. **VersionTree component** — `components/compare/version-tree.tsx`
   - Collapsible tree, checkboxes on versions, sticky footer with "Compare (N)" button

4. **CompareTable component** — `components/compare/compare-table.tsx`
   - Frozen first column: `sticky left-0 z-10` + solid background on the name cell
   - `overflow-x-auto` on the container
   - Diff detection, cell styling, filter toggle

5. **Catalog layout button** — add "Compare" link to `app/catalog/layout.tsx`

---

## Supabase Query Notes

Version tree query (selection branch):
```typescript
supabase
  .from("drone_types")
  .select(`id, name, slug,
    param_sets ( id, name,
      param_versions ( id, version_label, is_latest )
    )`)
  .order("name")
```

Compare data query (API route):
```typescript
supabase
  .from("param_values")
  .select(`
    name, value,
    param_version_id,
    param_versions!inner ( id, version_label,
      param_sets!inner ( name,
        drone_types!inner ( name )
      )
    )`)
  .in("param_version_id", versionIds)
  .order("name")
```

---

## Validation Reuse

`validateParam(value, def)` from `lib/param-engine.ts` is already exported. The compare table fetches param definitions via `/api/param-definitions` once on mount and calls `validateParam` per cell for invalid styling.

---

## Out of Scope
- Exporting a diff report
- Selecting a "base" version for relative comparison
- Three-way merge view
