# AIR6 Param Filter

A desktop tool for filtering Mission Planner `.param` files before applying them to a drone fleet. Export your configuration changes from one drone, strip out the parameters that must stay unique per drone (calibration, hardware IDs, RC setup), and apply only the safe changes to your target drones.

---

## Requirements

- Python 3.10 or newer
- Internet connection (for fetching ArduPilot parameter definitions)

---

## Installation

```
pip install customtkinter requests
```

Or using the requirements file:

```
pip install -r requirements.txt
```

---

## Running the App

```
python main.py
```

---

## Workflow

### 1. Export from Mission Planner
On the source drone (the one with your desired configuration), go to:
**Config → Full Parameter List → Save to File**

Save the `.param` file somewhere accessible.

### 2. Open the file
Click **Open .param File** and select the exported `.param` file.
All parameters are loaded and immediately split into two panels based on the active protection list.

### 3. Choose a protection list
Use the **Protection list** dropdown to select which set of parameters to protect.
The two panels update instantly:

| Left panel (red) | Right panel (green) |
|---|---|
| PROTECTED — will be **removed** | WILL BE APPLIED |
| Parameters that match the protection list | All other parameters |

### 4. Inspect parameters
Click any parameter in either panel to see its full description, units, valid range, and allowed values in the right-hand info panel. This data is pulled live from the official ArduPilot parameter database.

### 5. Save the filtered file
Click **Save Filtered File**. Only the green (right panel) parameters are written to the output file.

Apply that file to your target drone via Mission Planner:
**Config → Full Parameter List → Load from File**

---

## Protection Lists

Three lists are included out of the box:

### Calibration Parameters
Sensor calibration values that are unique to each physical drone. Applying these from another drone would corrupt the target drone's calibration and cause unstable flight.

Protects: compass offsets/diagonals/motor compensation, IMU accelerometer and gyro offsets and scale factors, barometer ground pressure, AHRS level trim, motor hover thrust.

### Hardware & Device IDs
Hardware identifiers and board-level configuration. These are assigned by the autopilot during initial setup and differ between units.

Protects: compass/IMU/barometer device IDs, serial port configuration, system ID, board type, board serial number, runtime statistics.

### RC Configuration
Radio calibration and channel mapping. These are specific to each operator's transmitter and must not be transferred between drones or pilots.

Protects: RC channels 1–16 (min/max/trim/deadzone/option), RC channel mapping (roll/pitch/throttle/yaw).

---

## Editing Protection Lists

Click **Edit Lists** to open the list editor.

- **Select a list** from the left panel to view and edit its rules.
- **Add a rule** by choosing a type and entering a value, then clicking **+ Add Rule** (or pressing Enter).
- **Remove a rule** by clicking on a rule row to select it, then clicking **Remove Selected**.
- **Create a new list** with **+ New List** — enter a name and optional description.
- **Delete a list** with the **Delete** button (cannot be undone).

### Rule types

| Type | Behaviour | Example |
|---|---|---|
| `prefix` | Removes all params whose name **starts with** the given string | `COMPASS_OFS` removes `COMPASS_OFS_X`, `COMPASS_OFS_Y`, `COMPASS_OFS_Z` |
| `exact` | Removes only the param whose name **matches exactly** | `MOT_THST_HOVER` removes only that one param |

Use `prefix` whenever you want to protect an entire group. Use `exact` for individual params.

Protection lists are stored as JSON files in `data/protection_lists/`. You can copy, back up, or share them freely.

---

## Parameter Definitions

On startup the app loads parameter definitions from a local cache (`data/apm_pdef_cache.json`). The cache is refreshed automatically if it is older than 24 hours.

To force an immediate refresh from the ArduPilot server, click **↻ Refresh Params** in the toolbar. The cache age is shown in the bottom-right corner of the window.

The definitions come from:
```
https://autotest.ardupilot.org/Parameters/ArduCopter/apm.pdef.json
```
This file is auto-generated daily from the ArduPilot source code and is the same source Mission Planner itself uses.
