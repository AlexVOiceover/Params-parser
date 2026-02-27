(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/lib/param-engine.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DEFAULT_PROTECTION_LISTS",
    ()=>DEFAULT_PROTECTION_LISTS,
    "applyFilter",
    ()=>applyFilter,
    "buildGroups",
    ()=>buildGroups,
    "matchesRule",
    ()=>matchesRule,
    "parseParamFile",
    ()=>parseParamFile,
    "writeParamFile",
    ()=>writeParamFile
]);
function parseParamFile(content) {
    const params = [];
    const lines = content.split("\n");
    for (const raw of lines){
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const commaIdx = line.indexOf(",");
        if (commaIdx < 0) continue;
        const name = line.slice(0, commaIdx).trim();
        const value = line.slice(commaIdx + 1).trim();
        if (name) {
            params.push({
                name,
                value
            });
        }
    }
    return params;
}
function writeParamFile(params) {
    return params.map((p)=>"".concat(p.name, ",").concat(p.value)).join("\n") + "\n";
}
function matchesRule(paramName, rule) {
    if (rule.type === "exact") return paramName === rule.value;
    if (rule.type === "prefix") return paramName.startsWith(rule.value);
    return false;
}
function applyFilter(params, rules) {
    const protectedParams = [];
    const remaining = [];
    for (const param of params){
        if (rules.some((rule)=>matchesRule(param.name, rule))) {
            protectedParams.push(param);
        } else {
            remaining.push(param);
        }
    }
    return {
        protected: protectedParams,
        remaining
    };
}
/**
 * Resolve which ArduPilot pdef group a param belongs to.
 * Matches the longest pdef group prefix.
 */ function resolveGroup(name, pdefGroups) {
    let bestLen = 0;
    let best = "";
    for (const g of pdefGroups){
        const gPrefix = g.replace(/_$/, "");
        if (!gPrefix) continue;
        if (name === gPrefix || name.startsWith(gPrefix + "_")) {
            if (gPrefix.length > bestLen) {
                bestLen = gPrefix.length;
                best = gPrefix;
            }
        }
    }
    if (best) return best;
    return name.includes("_") ? name.split("_")[0] : name;
}
function buildGroups(params, pdefGroups) {
    const map = {};
    for (const param of params){
        const g = resolveGroup(param.name, pdefGroups);
        if (!map[g]) map[g] = [];
        map[g].push(param);
    }
    return Object.entries(map).sort((param, param1)=>{
        let [a] = param, [b] = param1;
        return a.localeCompare(b);
    }).map((param)=>{
        let [label, params] = param;
        return {
            label,
            params
        };
    });
}
const DEFAULT_PROTECTION_LISTS = [
    {
        name: "Calibration Parameters",
        description: "Sensor calibration data that is specific to each physical drone (IMU offsets, compass calibration, barometer ground pressure, motor hover thrust). These should never be overwritten from another drone.",
        rules: [
            {
                type: "prefix",
                value: "COMPASS_OFS"
            },
            {
                type: "prefix",
                value: "COMPASS_DIA"
            },
            {
                type: "prefix",
                value: "COMPASS_MOT"
            },
            {
                type: "prefix",
                value: "COMPASS_ODI"
            },
            {
                type: "prefix",
                value: "COMPASS_SCALE"
            },
            {
                type: "prefix",
                value: "INS_ACCOFFS"
            },
            {
                type: "prefix",
                value: "INS_ACCSCAL"
            },
            {
                type: "prefix",
                value: "INS_GYROFFS"
            },
            {
                type: "prefix",
                value: "INS_ACC1_CALTEMP"
            },
            {
                type: "prefix",
                value: "INS_ACC2_CALTEMP"
            },
            {
                type: "prefix",
                value: "INS_ACC3_CALTEMP"
            },
            {
                type: "prefix",
                value: "INS_GYR1_CALTEMP"
            },
            {
                type: "prefix",
                value: "INS_GYR2_CALTEMP"
            },
            {
                type: "prefix",
                value: "INS_GYR3_CALTEMP"
            },
            {
                type: "prefix",
                value: "INS_ACC2OFFS"
            },
            {
                type: "prefix",
                value: "INS_ACC2SCAL"
            },
            {
                type: "prefix",
                value: "INS_ACC3OFFS"
            },
            {
                type: "prefix",
                value: "INS_ACC3SCAL"
            },
            {
                type: "prefix",
                value: "INS_GYR2OFFS"
            },
            {
                type: "prefix",
                value: "INS_GYR3OFFS"
            },
            {
                type: "prefix",
                value: "BARO1_GND"
            },
            {
                type: "prefix",
                value: "BARO2_GND"
            },
            {
                type: "prefix",
                value: "BARO3_GND"
            },
            {
                type: "exact",
                value: "AHRS_TRIM_X"
            },
            {
                type: "exact",
                value: "AHRS_TRIM_Y"
            },
            {
                type: "exact",
                value: "AHRS_TRIM_Z"
            },
            {
                type: "exact",
                value: "MOT_THST_HOVER"
            }
        ]
    },
    {
        name: "Hardware & Device IDs",
        description: "Hardware-specific identifiers, board type, device IDs, serial port configuration, and runtime statistics. These are unique to each physical unit and should not be transferred between drones.",
        rules: [
            {
                type: "prefix",
                value: "COMPASS_DEV_ID"
            },
            {
                type: "prefix",
                value: "COMPASS_PRIO"
            },
            {
                type: "exact",
                value: "INS_GYR_ID"
            },
            {
                type: "exact",
                value: "INS_GYR2_ID"
            },
            {
                type: "exact",
                value: "INS_GYR3_ID"
            },
            {
                type: "exact",
                value: "INS_ACC_ID"
            },
            {
                type: "exact",
                value: "INS_ACC2_ID"
            },
            {
                type: "exact",
                value: "INS_ACC3_ID"
            },
            {
                type: "prefix",
                value: "INS4_"
            },
            {
                type: "prefix",
                value: "INS5_"
            },
            {
                type: "exact",
                value: "BARO1_DEVID"
            },
            {
                type: "exact",
                value: "BARO2_DEVID"
            },
            {
                type: "exact",
                value: "BARO3_DEVID"
            },
            {
                type: "prefix",
                value: "STAT_"
            },
            {
                type: "exact",
                value: "SYSID_THISMAV"
            },
            {
                type: "exact",
                value: "BRD_SERIAL_NUM"
            },
            {
                type: "exact",
                value: "BRD_TYPE"
            },
            {
                type: "exact",
                value: "FORMAT_VERSION"
            },
            {
                type: "prefix",
                value: "SERIAL0_"
            },
            {
                type: "prefix",
                value: "SERIAL1_"
            },
            {
                type: "prefix",
                value: "SERIAL2_"
            },
            {
                type: "prefix",
                value: "SERIAL3_"
            },
            {
                type: "prefix",
                value: "SERIAL4_"
            },
            {
                type: "prefix",
                value: "SERIAL5_"
            },
            {
                type: "prefix",
                value: "SERIAL6_"
            }
        ]
    },
    {
        name: "RC Configuration",
        description: "Radio control calibration (min/max/trim per channel) and channel mapping. These are specific to each operator's transmitter and should not be applied to drones used by different pilots.",
        rules: [
            {
                type: "prefix",
                value: "RC1_"
            },
            {
                type: "prefix",
                value: "RC2_"
            },
            {
                type: "prefix",
                value: "RC3_"
            },
            {
                type: "prefix",
                value: "RC4_"
            },
            {
                type: "prefix",
                value: "RC5_"
            },
            {
                type: "prefix",
                value: "RC6_"
            },
            {
                type: "prefix",
                value: "RC7_"
            },
            {
                type: "prefix",
                value: "RC8_"
            },
            {
                type: "prefix",
                value: "RC9_"
            },
            {
                type: "prefix",
                value: "RC10_"
            },
            {
                type: "prefix",
                value: "RC11_"
            },
            {
                type: "prefix",
                value: "RC12_"
            },
            {
                type: "prefix",
                value: "RC13_"
            },
            {
                type: "prefix",
                value: "RC14_"
            },
            {
                type: "prefix",
                value: "RC15_"
            },
            {
                type: "prefix",
                value: "RC16_"
            },
            {
                type: "prefix",
                value: "RCMAP_"
            }
        ]
    }
];
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/user-store.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "clearStoredUsername",
    ()=>clearStoredUsername,
    "getStoredUsername",
    ()=>getStoredUsername,
    "isValidUsername",
    ()=>isValidUsername,
    "sanitizeUsername",
    ()=>sanitizeUsername,
    "storeUsername",
    ()=>storeUsername
]);
const USERNAME_KEY = "air6_username";
function getStoredUsername() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return localStorage.getItem(USERNAME_KEY);
}
function storeUsername(name) {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    localStorage.setItem(USERNAME_KEY, sanitizeUsername(name));
}
function clearStoredUsername() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    localStorage.removeItem(USERNAME_KEY);
}
function sanitizeUsername(raw) {
    return raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}
function isValidUsername(raw) {
    const s = sanitizeUsername(raw);
    return s.length >= 2 && s.length <= 20;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/app-context.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AppProvider",
    ()=>AppProvider,
    "useApp",
    ()=>useApp
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$param$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/param-engine.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$user$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/user-store.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
;
// ---------- helpers (module-level, no React deps) ----------
async function apiFetchLists(username) {
    try {
        const res = await fetch("/api/lists/".concat(encodeURIComponent(username)));
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}
async function apiSaveLists(username, lists) {
    try {
        const res = await fetch("/api/lists/".concat(encodeURIComponent(username)), {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(lists)
        });
        return await res.json();
    } catch (err) {
        return {
            ok: false,
            error: String(err)
        };
    }
}
const AppContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(null);
function AppProvider(param) {
    let { children } = param;
    var _DEFAULT_PROTECTION_LISTS_;
    _s();
    // --- user ---
    const [username, setUsernameState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [listsLoading, setListsLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const usernameRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    // true once the initial per-user list fetch (or skip) is done — prevents
    // saving defaults back to the server before we've loaded real data
    const listsReadyRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    // --- file ---
    const [fileName, setFileName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [allParams, setAllParams] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [protectedParams, setProtectedParams] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [remainingParams, setRemainingParams] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    // --- selection ---
    const [checkedProtected, setCheckedProtected] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(new Set());
    const [checkedRemaining, setCheckedRemaining] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(new Set());
    // --- protection lists ---
    const [protectionLists, setProtectionListsState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$param$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_PROTECTION_LISTS"]);
    var _DEFAULT_PROTECTION_LISTS__name;
    const [activeListName, setActiveListName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])((_DEFAULT_PROTECTION_LISTS__name = (_DEFAULT_PROTECTION_LISTS_ = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$param$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_PROTECTION_LISTS"][0]) === null || _DEFAULT_PROTECTION_LISTS_ === void 0 ? void 0 : _DEFAULT_PROTECTION_LISTS_.name) !== null && _DEFAULT_PROTECTION_LISTS__name !== void 0 ? _DEFAULT_PROTECTION_LISTS__name : "");
    // --- param defs ---
    const [paramDefs, setParamDefsState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [pdefGroups, setPdefGroups] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [cacheAge, setCacheAge] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("No cache");
    const [defsLoading, setDefsLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    // --- ui ---
    const [selectedParam, setSelectedParam] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [consoleEntries, setConsoleEntries] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [statusMessage, setStatusMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("Ready");
    const [baselineProtectedNames, setBaselineProtectedNames] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(new Set());
    // ---------- helpers ----------
    const log = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[log]": function(message) {
            let level = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "INFO";
            const ts = new Date().toLocaleTimeString("en-GB", {
                hour12: false
            });
            setConsoleEntries({
                "AppProvider.useCallback[log]": (prev)=>[
                        ...prev,
                        {
                            timestamp: ts,
                            level,
                            message
                        }
                    ]
            }["AppProvider.useCallback[log]"]);
        }
    }["AppProvider.useCallback[log]"], []);
    const doFilter = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[doFilter]": (params, listName, lists)=>{
            const list = lists.find({
                "AppProvider.useCallback[doFilter].list": (l)=>l.name === listName
            }["AppProvider.useCallback[doFilter].list"]);
            var _list_rules;
            const rules = (_list_rules = list === null || list === void 0 ? void 0 : list.rules) !== null && _list_rules !== void 0 ? _list_rules : [];
            const { protected: p, remaining: r } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$param$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["applyFilter"])(params, rules);
            setProtectedParams(p);
            setRemainingParams(r);
            setBaselineProtectedNames(new Set(p.map({
                "AppProvider.useCallback[doFilter]": (x)=>x.name
            }["AppProvider.useCallback[doFilter]"])));
            setCheckedProtected(new Set());
            setCheckedRemaining(new Set());
            setSelectedParam(null);
            setStatusMessage("".concat(p.length, " protected · ").concat(r.length, " will be applied"));
            return {
                p,
                r
            };
        }
    }["AppProvider.useCallback[doFilter]"], []);
    // ---------- user management ----------
    const loadListsForUser = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[loadListsForUser]": async (u, logFn)=>{
            setListsLoading(true);
            const result = await apiFetchLists(u);
            setListsLoading(false);
            if (result) {
                if (result.lists.length > 0) {
                    setProtectionListsState(result.lists);
                    setActiveListName({
                        "AppProvider.useCallback[loadListsForUser]": (prev)=>result.lists.some({
                                "AppProvider.useCallback[loadListsForUser]": (l)=>l.name === prev
                            }["AppProvider.useCallback[loadListsForUser]"]) ? prev : result.lists[0].name
                    }["AppProvider.useCallback[loadListsForUser]"]);
                }
                if (logFn) {
                    if (result.source === "kv") {
                        logFn("Lists loaded from server (".concat(result.lists.length, " list").concat(result.lists.length !== 1 ? "s" : "", ")"));
                    } else if (result.source === "defaults") {
                        logFn("No saved lists for '".concat(u, "' — using defaults"));
                    } else {
                        var _result_error;
                        logFn("Could not load lists from server: ".concat((_result_error = result.error) !== null && _result_error !== void 0 ? _result_error : "unknown error"), "WARN");
                    }
                }
            }
            listsReadyRef.current = true;
        }
    }["AppProvider.useCallback[loadListsForUser]"], []);
    // On mount: restore username from localStorage
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AppProvider.useEffect": ()=>{
            const stored = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$user$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getStoredUsername"])();
            if (stored) {
                usernameRef.current = stored;
                setUsernameState(stored);
                loadListsForUser(stored, log);
            } else {
                // No user — use defaults immediately, no API fetch needed
                listsReadyRef.current = true;
            }
        }
    }["AppProvider.useEffect"], [
        loadListsForUser,
        log
    ]);
    const setUser = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[setUser]": (name)=>{
            const clean = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$user$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sanitizeUsername"])(name);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$user$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["storeUsername"])(clean);
            usernameRef.current = clean;
            setUsernameState(clean);
            listsReadyRef.current = false;
            loadListsForUser(clean, log).then({
                "AppProvider.useCallback[setUser]": ()=>{
                    log("Signed in as '".concat(clean, "'"));
                }
            }["AppProvider.useCallback[setUser]"]);
        }
    }["AppProvider.useCallback[setUser]"], [
        loadListsForUser,
        log
    ]);
    const clearUser = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[clearUser]": ()=>{
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$user$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["clearStoredUsername"])();
            usernameRef.current = null;
            setUsernameState(null);
            listsReadyRef.current = false;
            log("Signed out — changes will not be persisted");
        }
    }["AppProvider.useCallback[clearUser]"], [
        log
    ]);
    // ---------- file ----------
    const loadFile = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[loadFile]": (name, content)=>{
            const params = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$param$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseParamFile"])(content);
            setFileName(name);
            setAllParams(params);
            const { p, r } = doFilter(params, activeListName, protectionLists);
            log("Opened '".concat(name, "' — ").concat(params.length, " params loaded. Filter '").concat(activeListName, "': ").concat(p.length, " protected, ").concat(r.length, " applied"));
        }
    }["AppProvider.useCallback[loadFile]"], [
        activeListName,
        protectionLists,
        doFilter,
        log
    ]);
    // ---------- list selection ----------
    const setActiveList = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[setActiveList]": (name)=>{
            setActiveListName(name);
            if (allParams.length > 0) {
                const { p, r } = doFilter(allParams, name, protectionLists);
                log("Filter '".concat(name, "' — ").concat(p.length, " protected, ").concat(r.length, " will be applied"));
            }
        }
    }["AppProvider.useCallback[setActiveList]"], [
        allParams,
        protectionLists,
        doFilter,
        log
    ]);
    // ---------- checkboxes ----------
    const toggleCheckedProtected = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[toggleCheckedProtected]": (name)=>{
            setCheckedProtected({
                "AppProvider.useCallback[toggleCheckedProtected]": (prev)=>{
                    const next = new Set(prev);
                    if (next.has(name)) next.delete(name);
                    else next.add(name);
                    return next;
                }
            }["AppProvider.useCallback[toggleCheckedProtected]"]);
        }
    }["AppProvider.useCallback[toggleCheckedProtected]"], []);
    const toggleCheckedRemaining = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[toggleCheckedRemaining]": (name)=>{
            setCheckedRemaining({
                "AppProvider.useCallback[toggleCheckedRemaining]": (prev)=>{
                    const next = new Set(prev);
                    if (next.has(name)) next.delete(name);
                    else next.add(name);
                    return next;
                }
            }["AppProvider.useCallback[toggleCheckedRemaining]"]);
        }
    }["AppProvider.useCallback[toggleCheckedRemaining]"], []);
    const toggleAllProtected = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[toggleAllProtected]": (checked)=>{
            setCheckedProtected(checked ? new Set(protectedParams.map({
                "AppProvider.useCallback[toggleAllProtected]": (p)=>p.name
            }["AppProvider.useCallback[toggleAllProtected]"])) : new Set());
        }
    }["AppProvider.useCallback[toggleAllProtected]"], [
        protectedParams
    ]);
    const toggleAllRemaining = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[toggleAllRemaining]": (checked)=>{
            setCheckedRemaining(checked ? new Set(remainingParams.map({
                "AppProvider.useCallback[toggleAllRemaining]": (p)=>p.name
            }["AppProvider.useCallback[toggleAllRemaining]"])) : new Set());
        }
    }["AppProvider.useCallback[toggleAllRemaining]"], [
        remainingParams
    ]);
    const toggleGroupProtected = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[toggleGroupProtected]": (paramNames)=>{
            setCheckedProtected({
                "AppProvider.useCallback[toggleGroupProtected]": (prev)=>{
                    const next = new Set(prev);
                    const allChecked = paramNames.every({
                        "AppProvider.useCallback[toggleGroupProtected].allChecked": (n)=>next.has(n)
                    }["AppProvider.useCallback[toggleGroupProtected].allChecked"]);
                    if (allChecked) paramNames.forEach({
                        "AppProvider.useCallback[toggleGroupProtected]": (n)=>next.delete(n)
                    }["AppProvider.useCallback[toggleGroupProtected]"]);
                    else paramNames.forEach({
                        "AppProvider.useCallback[toggleGroupProtected]": (n)=>next.add(n)
                    }["AppProvider.useCallback[toggleGroupProtected]"]);
                    return next;
                }
            }["AppProvider.useCallback[toggleGroupProtected]"]);
        }
    }["AppProvider.useCallback[toggleGroupProtected]"], []);
    const toggleGroupRemaining = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[toggleGroupRemaining]": (paramNames)=>{
            setCheckedRemaining({
                "AppProvider.useCallback[toggleGroupRemaining]": (prev)=>{
                    const next = new Set(prev);
                    const allChecked = paramNames.every({
                        "AppProvider.useCallback[toggleGroupRemaining].allChecked": (n)=>next.has(n)
                    }["AppProvider.useCallback[toggleGroupRemaining].allChecked"]);
                    if (allChecked) paramNames.forEach({
                        "AppProvider.useCallback[toggleGroupRemaining]": (n)=>next.delete(n)
                    }["AppProvider.useCallback[toggleGroupRemaining]"]);
                    else paramNames.forEach({
                        "AppProvider.useCallback[toggleGroupRemaining]": (n)=>next.add(n)
                    }["AppProvider.useCallback[toggleGroupRemaining]"]);
                    return next;
                }
            }["AppProvider.useCallback[toggleGroupRemaining]"]);
        }
    }["AppProvider.useCallback[toggleGroupRemaining]"], []);
    // ---------- move params ----------
    const moveCheckedToProtected = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[moveCheckedToProtected]": ()=>{
            if (checkedRemaining.size === 0) return;
            const toMove = remainingParams.filter({
                "AppProvider.useCallback[moveCheckedToProtected].toMove": (p)=>checkedRemaining.has(p.name)
            }["AppProvider.useCallback[moveCheckedToProtected].toMove"]);
            const names = new Set(toMove.map({
                "AppProvider.useCallback[moveCheckedToProtected]": (p)=>p.name
            }["AppProvider.useCallback[moveCheckedToProtected]"]));
            setRemainingParams({
                "AppProvider.useCallback[moveCheckedToProtected]": (prev)=>prev.filter({
                        "AppProvider.useCallback[moveCheckedToProtected]": (p)=>!names.has(p.name)
                    }["AppProvider.useCallback[moveCheckedToProtected]"])
            }["AppProvider.useCallback[moveCheckedToProtected]"]);
            setProtectedParams({
                "AppProvider.useCallback[moveCheckedToProtected]": (prev)=>[
                        ...prev,
                        ...toMove
                    ]
            }["AppProvider.useCallback[moveCheckedToProtected]"]);
            setCheckedRemaining(new Set());
            const preview = toMove.slice(0, 4).map({
                "AppProvider.useCallback[moveCheckedToProtected]": (p)=>p.name
            }["AppProvider.useCallback[moveCheckedToProtected]"]).join(", ") + (toMove.length > 4 ? " ..." : "");
            log("Moved ".concat(toMove.length, " param(s) to Protected: ").concat(preview));
        }
    }["AppProvider.useCallback[moveCheckedToProtected]"], [
        checkedRemaining,
        remainingParams,
        log
    ]);
    const moveCheckedToRemaining = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[moveCheckedToRemaining]": ()=>{
            if (checkedProtected.size === 0) return;
            const toMove = protectedParams.filter({
                "AppProvider.useCallback[moveCheckedToRemaining].toMove": (p)=>checkedProtected.has(p.name)
            }["AppProvider.useCallback[moveCheckedToRemaining].toMove"]);
            const names = new Set(toMove.map({
                "AppProvider.useCallback[moveCheckedToRemaining]": (p)=>p.name
            }["AppProvider.useCallback[moveCheckedToRemaining]"]));
            setProtectedParams({
                "AppProvider.useCallback[moveCheckedToRemaining]": (prev)=>prev.filter({
                        "AppProvider.useCallback[moveCheckedToRemaining]": (p)=>!names.has(p.name)
                    }["AppProvider.useCallback[moveCheckedToRemaining]"])
            }["AppProvider.useCallback[moveCheckedToRemaining]"]);
            setRemainingParams({
                "AppProvider.useCallback[moveCheckedToRemaining]": (prev)=>[
                        ...prev,
                        ...toMove
                    ]
            }["AppProvider.useCallback[moveCheckedToRemaining]"]);
            setCheckedProtected(new Set());
            const preview = toMove.slice(0, 4).map({
                "AppProvider.useCallback[moveCheckedToRemaining]": (p)=>p.name
            }["AppProvider.useCallback[moveCheckedToRemaining]"]).join(", ") + (toMove.length > 4 ? " ..." : "");
            log("Moved ".concat(toMove.length, " param(s) to Will Be Applied: ").concat(preview));
        }
    }["AppProvider.useCallback[moveCheckedToRemaining]"], [
        checkedProtected,
        protectedParams,
        log
    ]);
    // ---------- misc ----------
    const selectParam = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[selectParam]": (name, value)=>{
            setSelectedParam({
                name,
                value
            });
        }
    }["AppProvider.useCallback[selectParam]"], []);
    const setParamDefs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[setParamDefs]": (defs, groups, age)=>{
            setParamDefsState(defs);
            setPdefGroups(groups);
            setCacheAge(age);
        }
    }["AppProvider.useCallback[setParamDefs]"], []);
    const clearConsole = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[clearConsole]": ()=>{
            setConsoleEntries([]);
        }
    }["AppProvider.useCallback[clearConsole]"], []);
    // ---------- protection list mutations (auto-saves to KV) ----------
    const updateProtectionLists = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AppProvider.useCallback[updateProtectionLists]": (lists)=>{
            setProtectionListsState(lists);
            if (allParams.length > 0) {
                doFilter(allParams, activeListName, lists);
            }
            // Persist — only after the initial fetch completed, and only if signed in
            if (listsReadyRef.current && usernameRef.current) {
                apiSaveLists(usernameRef.current, lists).then({
                    "AppProvider.useCallback[updateProtectionLists]": (result)=>{
                        if (result.ok) {
                            log("Lists saved to server");
                        } else {
                            var _result_error;
                            log("Lists save failed: ".concat((_result_error = result.error) !== null && _result_error !== void 0 ? _result_error : "unknown error"), "WARN");
                        }
                    }
                }["AppProvider.useCallback[updateProtectionLists]"]);
            }
        }
    }["AppProvider.useCallback[updateProtectionLists]"], [
        allParams,
        activeListName,
        doFilter,
        log
    ]);
    // ---------- render ----------
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AppContext.Provider, {
        value: {
            username,
            listsLoading,
            fileName,
            allParams,
            protectedParams,
            remainingParams,
            checkedProtected,
            checkedRemaining,
            protectionLists,
            activeListName,
            paramDefs,
            pdefGroups,
            cacheAge,
            defsLoading,
            selectedParam,
            consoleEntries,
            statusMessage,
            isProtectionModified: protectedParams.length > 0 && (protectedParams.length !== baselineProtectedNames.size || protectedParams.some((p)=>!baselineProtectedNames.has(p.name))),
            setUser,
            clearUser,
            loadFile,
            setActiveList,
            toggleCheckedProtected,
            toggleCheckedRemaining,
            toggleAllProtected,
            toggleAllRemaining,
            toggleGroupProtected,
            toggleGroupRemaining,
            moveCheckedToProtected,
            moveCheckedToRemaining,
            selectParam,
            setParamDefs,
            setDefsLoading,
            setProtectionLists: updateProtectionLists,
            log,
            clearConsole
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/lib/app-context.tsx",
        lineNumber: 413,
        columnNumber: 5
    }, this);
}
_s(AppProvider, "qkWrKR1yZNb4tUDSM4+DRDovUcA=");
_c = AppProvider;
function useApp() {
    _s1();
    const ctx = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(AppContext);
    if (!ctx) throw new Error("useApp must be used inside AppProvider");
    return ctx;
}
_s1(useApp, "/dMy7t63NXD4eYACoT93CePwGrg=");
var _c;
__turbopack_context__.k.register(_c, "AppProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/utils.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "cn",
    ()=>cn
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/clsx/dist/clsx.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/tailwind-merge/dist/bundle-mjs.mjs [app-client] (ecmascript)");
;
;
function cn() {
    for(var _len = arguments.length, inputs = new Array(_len), _key = 0; _key < _len; _key++){
        inputs[_key] = arguments[_key];
    }
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["twMerge"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["clsx"])(inputs));
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/file-upload.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FileUpload",
    ()=>FileUpload
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$upload$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Upload$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/upload.js [app-client] (ecmascript) <export default as Upload>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/app-context.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
function FileUpload() {
    _s();
    const inputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const { loadFile } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useApp"])();
    function handleFileChange(e) {
        var _e_target_files;
        const file = (_e_target_files = e.target.files) === null || _e_target_files === void 0 ? void 0 : _e_target_files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ()=>{
            const content = reader.result;
            loadFile(file.name, content);
        };
        reader.readAsText(file);
        // Reset so the same file can be re-selected
        e.target.value = "";
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                ref: inputRef,
                type: "file",
                accept: ".param,.parm",
                className: "hidden",
                onChange: handleFileChange
            }, void 0, false, {
                fileName: "[project]/components/file-upload.tsx",
                lineNumber: 26,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                onClick: ()=>{
                    var _inputRef_current;
                    return (_inputRef_current = inputRef.current) === null || _inputRef_current === void 0 ? void 0 : _inputRef_current.click();
                },
                className: "flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$upload$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Upload$3e$__["Upload"], {
                        className: "h-4 w-4"
                    }, void 0, false, {
                        fileName: "[project]/components/file-upload.tsx",
                        lineNumber: 37,
                        columnNumber: 9
                    }, this),
                    "Open .param File"
                ]
            }, void 0, true, {
                fileName: "[project]/components/file-upload.tsx",
                lineNumber: 33,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true);
}
_s(FileUpload, "sfFD3tpmQq7qmwepOsrwsYzyuYM=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useApp"]
    ];
});
_c = FileUpload;
var _c;
__turbopack_context__.k.register(_c, "FileUpload");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/protection-list-select.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ProtectionListSelect",
    ()=>ProtectionListSelect
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/app-context.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
const EDIT_SENTINEL = "__edit_lists__";
function ProtectionListSelect(param) {
    let { onEditLists } = param;
    _s();
    const { protectionLists, activeListName, setActiveList } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useApp"])();
    function handleChange(e) {
        if (e.target.value === EDIT_SENTINEL) {
            // Reset the visual selection back to the active list
            e.target.value = activeListName;
            onEditLists();
        } else {
            setActiveList(e.target.value);
        }
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-center gap-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-sm text-muted-foreground whitespace-nowrap",
                children: "Protection list:"
            }, void 0, false, {
                fileName: "[project]/components/protection-list-select.tsx",
                lineNumber: 26,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                value: activeListName,
                onChange: handleChange,
                className: "h-9 rounded-md border border-border bg-secondary px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring",
                children: [
                    protectionLists.map((pl)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                            value: pl.name,
                            children: pl.name
                        }, pl.name, false, {
                            fileName: "[project]/components/protection-list-select.tsx",
                            lineNumber: 35,
                            columnNumber: 11
                        }, this)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                        disabled: true,
                        value: "",
                        children: "──────────────"
                    }, void 0, false, {
                        fileName: "[project]/components/protection-list-select.tsx",
                        lineNumber: 39,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                        value: EDIT_SENTINEL,
                        children: "✏  Edit Lists…"
                    }, void 0, false, {
                        fileName: "[project]/components/protection-list-select.tsx",
                        lineNumber: 40,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/protection-list-select.tsx",
                lineNumber: 29,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/protection-list-select.tsx",
        lineNumber: 25,
        columnNumber: 5
    }, this);
}
_s(ProtectionListSelect, "p+XdpeNkNGWfqex5rz0Bd29Pxyo=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useApp"]
    ];
});
_c = ProtectionListSelect;
var _c;
__turbopack_context__.k.register(_c, "ProtectionListSelect");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/param-panel.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ParamPanel",
    ()=>ParamPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronRight$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-right.js [app-client] (ecmascript) <export default as ChevronRight>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDown$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-down.js [app-client] (ecmascript) <export default as ChevronDown>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$param$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/param-engine.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
function ParamPanel(param) {
    let { title, headerColor, params, checkedNames, pdefGroups, onToggleCheck, onToggleAll, onToggleGroup, onSelectParam, headerAction } = param;
    _s();
    const [expandedGroups, setExpandedGroups] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(new Set());
    const [searchQuery, setSearchQuery] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const groups = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "ParamPanel.useMemo[groups]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$param$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["buildGroups"])(params, pdefGroups)
    }["ParamPanel.useMemo[groups]"], [
        params,
        pdefGroups
    ]);
    const filteredGroups = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "ParamPanel.useMemo[filteredGroups]": ()=>{
            if (!searchQuery.trim()) return groups;
            const q = searchQuery.toUpperCase();
            return groups.map({
                "ParamPanel.useMemo[filteredGroups]": (g)=>({
                        ...g,
                        params: g.params.filter({
                            "ParamPanel.useMemo[filteredGroups]": (p)=>p.name.includes(q)
                        }["ParamPanel.useMemo[filteredGroups]"])
                    })
            }["ParamPanel.useMemo[filteredGroups]"]).filter({
                "ParamPanel.useMemo[filteredGroups]": (g)=>g.params.length > 0
            }["ParamPanel.useMemo[filteredGroups]"]);
        }
    }["ParamPanel.useMemo[filteredGroups]"], [
        groups,
        searchQuery
    ]);
    const allChecked = params.length > 0 && params.every((p)=>checkedNames.has(p.name));
    const someChecked = params.some((p)=>checkedNames.has(p.name));
    const toggleGroup = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ParamPanel.useCallback[toggleGroup]": (label)=>{
            setExpandedGroups({
                "ParamPanel.useCallback[toggleGroup]": (prev)=>{
                    const next = new Set(prev);
                    if (next.has(label)) next.delete(label);
                    else next.add(label);
                    return next;
                }
            }["ParamPanel.useCallback[toggleGroup]"]);
        }
    }["ParamPanel.useCallback[toggleGroup]"], []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-1 flex-col rounded-lg border border-border bg-card overflow-hidden min-w-0",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex items-center gap-2 px-3 py-2.5", headerColor),
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "checkbox",
                        checked: allChecked,
                        ref: (el)=>{
                            if (el) el.indeterminate = someChecked && !allChecked;
                        },
                        onChange: (e)=>onToggleAll(e.target.checked),
                        className: "h-4 w-4 rounded accent-foreground cursor-pointer",
                        "aria-label": "Select all parameters"
                    }, void 0, false, {
                        fileName: "[project]/components/param-panel.tsx",
                        lineNumber: 71,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "flex-1 text-sm font-semibold text-foreground truncate",
                        children: [
                            title,
                            " (",
                            params.length,
                            ")"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/param-panel.tsx",
                        lineNumber: 81,
                        columnNumber: 9
                    }, this),
                    headerAction
                ]
            }, void 0, true, {
                fileName: "[project]/components/param-panel.tsx",
                lineNumber: 68,
                columnNumber: 7
            }, this),
            params.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "px-2 py-1.5 border-b border-border",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                    type: "text",
                    placeholder: "Search params...",
                    value: searchQuery,
                    onChange: (e)=>setSearchQuery(e.target.value),
                    className: "w-full rounded bg-muted px-2.5 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                }, void 0, false, {
                    fileName: "[project]/components/param-panel.tsx",
                    lineNumber: 90,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/param-panel.tsx",
                lineNumber: 89,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1 overflow-y-auto min-h-0",
                children: [
                    filteredGroups.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-center py-12 text-sm text-muted-foreground",
                        children: params.length === 0 ? "No parameters loaded" : "No matching parameters"
                    }, void 0, false, {
                        fileName: "[project]/components/param-panel.tsx",
                        lineNumber: 103,
                        columnNumber: 11
                    }, this),
                    filteredGroups.map((group)=>{
                        const isOpen = expandedGroups.has(group.label);
                        const groupNames = group.params.map((p)=>p.name);
                        const groupAllChecked = groupNames.every((n)=>checkedNames.has(n));
                        const groupSomeChecked = groupNames.some((n)=>checkedNames.has(n));
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: ()=>toggleGroup(group.label),
                                    className: "flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-secondary/50 transition-colors",
                                    children: [
                                        isOpen ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDown$3e$__["ChevronDown"], {
                                            className: "h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                        }, void 0, false, {
                                            fileName: "[project]/components/param-panel.tsx",
                                            lineNumber: 123,
                                            columnNumber: 19
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronRight$3e$__["ChevronRight"], {
                                            className: "h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                        }, void 0, false, {
                                            fileName: "[project]/components/param-panel.tsx",
                                            lineNumber: 125,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: "checkbox",
                                            checked: groupAllChecked,
                                            ref: (el)=>{
                                                if (el) el.indeterminate = groupSomeChecked && !groupAllChecked;
                                            },
                                            onClick: (e)=>e.stopPropagation(),
                                            onChange: ()=>onToggleGroup(groupNames),
                                            className: "h-3.5 w-3.5 rounded accent-foreground cursor-pointer",
                                            "aria-label": "Select all in ".concat(group.label)
                                        }, void 0, false, {
                                            fileName: "[project]/components/param-panel.tsx",
                                            lineNumber: 127,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-xs font-semibold text-group-text truncate",
                                            children: group.label
                                        }, void 0, false, {
                                            fileName: "[project]/components/param-panel.tsx",
                                            lineNumber: 139,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "ml-auto text-[10px] text-muted-foreground tabular-nums",
                                            children: group.params.length
                                        }, void 0, false, {
                                            fileName: "[project]/components/param-panel.tsx",
                                            lineNumber: 142,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/param-panel.tsx",
                                    lineNumber: 118,
                                    columnNumber: 15
                                }, this),
                                isOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: group.params.map((param)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center gap-2 py-1 pl-9 pr-3 hover:bg-secondary/30 transition-colors cursor-pointer",
                                            onClick: ()=>onSelectParam(param.name, param.value),
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                    type: "checkbox",
                                                    checked: checkedNames.has(param.name),
                                                    onClick: (e)=>e.stopPropagation(),
                                                    onChange: ()=>onToggleCheck(param.name),
                                                    className: "h-3.5 w-3.5 shrink-0 rounded accent-foreground cursor-pointer",
                                                    "aria-label": "Select ".concat(param.name)
                                                }, void 0, false, {
                                                    fileName: "[project]/components/param-panel.tsx",
                                                    lineNumber: 156,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "flex-1 truncate font-mono text-xs text-foreground",
                                                    children: param.name
                                                }, void 0, false, {
                                                    fileName: "[project]/components/param-panel.tsx",
                                                    lineNumber: 164,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "shrink-0 font-mono text-xs text-muted-foreground tabular-nums",
                                                    children: param.value
                                                }, void 0, false, {
                                                    fileName: "[project]/components/param-panel.tsx",
                                                    lineNumber: 167,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, param.name, true, {
                                            fileName: "[project]/components/param-panel.tsx",
                                            lineNumber: 151,
                                            columnNumber: 21
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/components/param-panel.tsx",
                                    lineNumber: 149,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, group.label, true, {
                            fileName: "[project]/components/param-panel.tsx",
                            lineNumber: 116,
                            columnNumber: 13
                        }, this);
                    })
                ]
            }, void 0, true, {
                fileName: "[project]/components/param-panel.tsx",
                lineNumber: 101,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/param-panel.tsx",
        lineNumber: 66,
        columnNumber: 5
    }, this);
}
_s(ParamPanel, "m25hnKlWp6g3/WwCuRojRpmbgGg=");
_c = ParamPanel;
var _c;
__turbopack_context__.k.register(_c, "ParamPanel");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/detail-panel.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DetailPanel",
    ()=>DetailPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/app-context.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
function DetailPanel() {
    _s();
    const { selectedParam, paramDefs } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useApp"])();
    if (!selectedParam) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex items-center justify-center h-full text-sm text-muted-foreground",
            children: "Click a parameter to see details"
        }, void 0, false, {
            fileName: "[project]/components/detail-panel.tsx",
            lineNumber: 11,
            columnNumber: 7
        }, this);
    }
    var _paramDefs_selectedParam_name;
    const meta = (_paramDefs_selectedParam_name = paramDefs[selectedParam.name]) !== null && _paramDefs_selectedParam_name !== void 0 ? _paramDefs_selectedParam_name : {};
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col gap-3 p-4 overflow-y-auto h-full",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        className: "font-mono text-sm font-bold text-foreground",
                        children: selectedParam.name
                    }, void 0, false, {
                        fileName: "[project]/components/detail-panel.tsx",
                        lineNumber: 22,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "font-mono text-xs text-muted-foreground mt-0.5",
                        children: [
                            "Value: ",
                            selectedParam.value
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/detail-panel.tsx",
                        lineNumber: 25,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/detail-panel.tsx",
                lineNumber: 21,
                columnNumber: 7
            }, this),
            meta.DisplayName && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-xs font-semibold text-group-text",
                        children: "Label"
                    }, void 0, false, {
                        fileName: "[project]/components/detail-panel.tsx",
                        lineNumber: 32,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm text-foreground",
                        children: meta.DisplayName
                    }, void 0, false, {
                        fileName: "[project]/components/detail-panel.tsx",
                        lineNumber: 33,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/detail-panel.tsx",
                lineNumber: 31,
                columnNumber: 9
            }, this),
            meta.Description && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-xs font-semibold text-group-text",
                        children: "Description"
                    }, void 0, false, {
                        fileName: "[project]/components/detail-panel.tsx",
                        lineNumber: 39,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm text-foreground leading-relaxed",
                        children: meta.Description
                    }, void 0, false, {
                        fileName: "[project]/components/detail-panel.tsx",
                        lineNumber: 42,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/detail-panel.tsx",
                lineNumber: 38,
                columnNumber: 9
            }, this),
            meta.Units && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-xs font-semibold text-group-text",
                        children: "Units"
                    }, void 0, false, {
                        fileName: "[project]/components/detail-panel.tsx",
                        lineNumber: 50,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm text-foreground",
                        children: meta.Units
                    }, void 0, false, {
                        fileName: "[project]/components/detail-panel.tsx",
                        lineNumber: 51,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/detail-panel.tsx",
                lineNumber: 49,
                columnNumber: 9
            }, this),
            meta.Range && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-xs font-semibold text-group-text",
                        children: "Range"
                    }, void 0, false, {
                        fileName: "[project]/components/detail-panel.tsx",
                        lineNumber: 57,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "font-mono text-xs text-foreground",
                        children: [
                            meta.Range.low,
                            " – ",
                            meta.Range.high
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/detail-panel.tsx",
                        lineNumber: 58,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/detail-panel.tsx",
                lineNumber: 56,
                columnNumber: 9
            }, this),
            meta.Values && Object.keys(meta.Values).length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-xs font-semibold text-group-text",
                        children: "Allowed Values"
                    }, void 0, false, {
                        fileName: "[project]/components/detail-panel.tsx",
                        lineNumber: 66,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-1 flex flex-col gap-0.5",
                        children: Object.entries(meta.Values).map((param)=>{
                            let [k, v] = param;
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "font-mono text-xs text-foreground",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-muted-foreground",
                                        children: k
                                    }, void 0, false, {
                                        fileName: "[project]/components/detail-panel.tsx",
                                        lineNumber: 72,
                                        columnNumber: 17
                                    }, this),
                                    " = ",
                                    v
                                ]
                            }, k, true, {
                                fileName: "[project]/components/detail-panel.tsx",
                                lineNumber: 71,
                                columnNumber: 15
                            }, this);
                        })
                    }, void 0, false, {
                        fileName: "[project]/components/detail-panel.tsx",
                        lineNumber: 69,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/detail-panel.tsx",
                lineNumber: 65,
                columnNumber: 9
            }, this),
            meta.Bitmask && Object.keys(meta.Bitmask).length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-xs font-semibold text-group-text",
                        children: "Bitmask"
                    }, void 0, false, {
                        fileName: "[project]/components/detail-panel.tsx",
                        lineNumber: 81,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-1 flex flex-col gap-0.5",
                        children: Object.entries(meta.Bitmask).map((param)=>{
                            let [bit, label] = param;
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "font-mono text-xs text-foreground",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-muted-foreground",
                                        children: [
                                            "bit ",
                                            bit,
                                            ":"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/detail-panel.tsx",
                                        lineNumber: 87,
                                        columnNumber: 17
                                    }, this),
                                    " ",
                                    label
                                ]
                            }, bit, true, {
                                fileName: "[project]/components/detail-panel.tsx",
                                lineNumber: 86,
                                columnNumber: 15
                            }, this);
                        })
                    }, void 0, false, {
                        fileName: "[project]/components/detail-panel.tsx",
                        lineNumber: 84,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/detail-panel.tsx",
                lineNumber: 80,
                columnNumber: 9
            }, this),
            meta.RebootRequired === "True" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded bg-destructive/20 px-3 py-2 text-xs font-medium text-destructive-foreground",
                children: "Reboot required after change"
            }, void 0, false, {
                fileName: "[project]/components/detail-panel.tsx",
                lineNumber: 96,
                columnNumber: 9
            }, this),
            !meta.DisplayName && !meta.Description && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-xs text-muted-foreground italic",
                children: "No definition found in ArduPilot database"
            }, void 0, false, {
                fileName: "[project]/components/detail-panel.tsx",
                lineNumber: 102,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/detail-panel.tsx",
        lineNumber: 20,
        columnNumber: 5
    }, this);
}
_s(DetailPanel, "UYezWRVVyZOy+g4qEqFXcNzGg1k=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useApp"]
    ];
});
_c = DetailPanel;
var _c;
__turbopack_context__.k.register(_c, "DetailPanel");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/console-panel.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ConsolePanel",
    ()=>ConsolePanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/app-context.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
function ConsolePanel() {
    _s();
    const { consoleEntries, clearConsole } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useApp"])();
    const endRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ConsolePanel.useEffect": ()=>{
            var _endRef_current;
            (_endRef_current = endRef.current) === null || _endRef_current === void 0 ? void 0 : _endRef_current.scrollIntoView({
                behavior: "smooth"
            });
        }
    }["ConsolePanel.useEffect"], [
        consoleEntries
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col h-full",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between px-3 py-1.5 border-b border-border",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-xs font-semibold text-foreground",
                        children: "Console"
                    }, void 0, false, {
                        fileName: "[project]/components/console-panel.tsx",
                        lineNumber: 19,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: clearConsole,
                        className: "flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-muted-foreground border border-border hover:bg-secondary transition-colors",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                className: "h-3 w-3"
                            }, void 0, false, {
                                fileName: "[project]/components/console-panel.tsx",
                                lineNumber: 24,
                                columnNumber: 11
                            }, this),
                            "Clear"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/console-panel.tsx",
                        lineNumber: 20,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/console-panel.tsx",
                lineNumber: 18,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1 overflow-y-auto bg-console-bg p-2 min-h-0",
                children: [
                    consoleEntries.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs text-muted-foreground italic",
                        children: "No log entries yet"
                    }, void 0, false, {
                        fileName: "[project]/components/console-panel.tsx",
                        lineNumber: 30,
                        columnNumber: 11
                    }, this),
                    consoleEntries.map((entry, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "font-mono text-[11px] leading-relaxed",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-muted-foreground",
                                    children: [
                                        "[",
                                        entry.timestamp,
                                        "]"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/console-panel.tsx",
                                    lineNumber: 36,
                                    columnNumber: 13
                                }, this),
                                " ",
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(entry.level === "ERROR" && "text-destructive-foreground", entry.level === "WARN" && "text-yellow-400", entry.level === "INFO" && "text-console-text"),
                                    children: [
                                        entry.level,
                                        ":"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/console-panel.tsx",
                                    lineNumber: 37,
                                    columnNumber: 13
                                }, this),
                                " ",
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-console-text",
                                    children: entry.message
                                }, void 0, false, {
                                    fileName: "[project]/components/console-panel.tsx",
                                    lineNumber: 46,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, i, true, {
                            fileName: "[project]/components/console-panel.tsx",
                            lineNumber: 35,
                            columnNumber: 11
                        }, this)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        ref: endRef
                    }, void 0, false, {
                        fileName: "[project]/components/console-panel.tsx",
                        lineNumber: 49,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/console-panel.tsx",
                lineNumber: 28,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/console-panel.tsx",
        lineNumber: 17,
        columnNumber: 5
    }, this);
}
_s(ConsolePanel, "KHGivVmP0sx2DtMbQs7Xbof19RQ=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useApp"]
    ];
});
_c = ConsolePanel;
var _c;
__turbopack_context__.k.register(_c, "ConsolePanel");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/list-editor-dialog.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ListEditorDialog",
    ()=>ListEditorDialog
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/plus.js [app-client] (ecmascript) <export default as Plus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trash-2.js [app-client] (ecmascript) <export default as Trash2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Shield$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/shield.js [app-client] (ecmascript) <export default as Shield>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/app-context.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
const MAX_SUGGESTIONS = 12;
function ListEditorDialog(param) {
    let { onClose } = param;
    _s();
    const { protectionLists, setProtectionLists, log, paramDefs, pdefGroups } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useApp"])();
    const [lists, setLists] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "ListEditorDialog.useState": ()=>JSON.parse(JSON.stringify(protectionLists))
    }["ListEditorDialog.useState"]);
    const [selectedIdx, setSelectedIdx] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(lists.length > 0 ? 0 : -1);
    // Rule input
    const [ruleType, setRuleType] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("prefix");
    const [ruleInput, setRuleInput] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [showSuggestions, setShowSuggestions] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [suggestionIdx, setSuggestionIdx] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(-1);
    const inputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    // New list inline form
    const [showNewList, setShowNewList] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [newListName, setNewListName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [newListDesc, setNewListDesc] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const selectedList = selectedIdx >= 0 ? lists[selectedIdx] : null;
    // Autocomplete suggestions filtered by type and query, excluding already-added rules
    const suggestions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "ListEditorDialog.useMemo[suggestions]": ()=>{
            var _lists_selectedIdx;
            const q = ruleInput.trim().toUpperCase();
            if (!q) return [];
            var _lists_selectedIdx_rules;
            const existing = new Set(((_lists_selectedIdx_rules = (_lists_selectedIdx = lists[selectedIdx]) === null || _lists_selectedIdx === void 0 ? void 0 : _lists_selectedIdx.rules) !== null && _lists_selectedIdx_rules !== void 0 ? _lists_selectedIdx_rules : []).filter({
                "ListEditorDialog.useMemo[suggestions]": (r)=>r.type === ruleType
            }["ListEditorDialog.useMemo[suggestions]"]).map({
                "ListEditorDialog.useMemo[suggestions]": (r)=>r.value
            }["ListEditorDialog.useMemo[suggestions]"]));
            const pool = ruleType === "prefix" ? pdefGroups : Object.keys(paramDefs);
            return pool.filter({
                "ListEditorDialog.useMemo[suggestions]": (s)=>!existing.has(s.toUpperCase())
            }["ListEditorDialog.useMemo[suggestions]"]).filter({
                "ListEditorDialog.useMemo[suggestions]": (s)=>s.toUpperCase().includes(q)
            }["ListEditorDialog.useMemo[suggestions]"]).sort({
                "ListEditorDialog.useMemo[suggestions]": (a, b)=>{
                    const aStarts = a.toUpperCase().startsWith(q);
                    const bStarts = b.toUpperCase().startsWith(q);
                    if (aStarts && !bStarts) return -1;
                    if (!aStarts && bStarts) return 1;
                    return a.localeCompare(b);
                }
            }["ListEditorDialog.useMemo[suggestions]"]).slice(0, MAX_SUGGESTIONS);
        }
    }["ListEditorDialog.useMemo[suggestions]"], [
        ruleInput,
        ruleType,
        paramDefs,
        pdefGroups,
        lists,
        selectedIdx
    ]);
    const addRule = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ListEditorDialog.useCallback[addRule]": (value)=>{
            if (selectedIdx < 0 || !value.trim()) return;
            const v = value.trim().toUpperCase();
            if (lists[selectedIdx].rules.some({
                "ListEditorDialog.useCallback[addRule]": (r)=>r.type === ruleType && r.value === v
            }["ListEditorDialog.useCallback[addRule]"])) return;
            const updated = [
                ...lists
            ];
            updated[selectedIdx] = {
                ...updated[selectedIdx],
                rules: [
                    ...updated[selectedIdx].rules,
                    {
                        type: ruleType,
                        value: v
                    }
                ]
            };
            setLists(updated);
            setRuleInput("");
            setShowSuggestions(false);
            setSuggestionIdx(-1);
        }
    }["ListEditorDialog.useCallback[addRule]"], [
        selectedIdx,
        ruleType,
        lists
    ]);
    const removeRule = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ListEditorDialog.useCallback[removeRule]": (ruleIdx)=>{
            if (selectedIdx < 0) return;
            const updated = [
                ...lists
            ];
            const rules = [
                ...updated[selectedIdx].rules
            ];
            rules.splice(ruleIdx, 1);
            updated[selectedIdx] = {
                ...updated[selectedIdx],
                rules
            };
            setLists(updated);
        }
    }["ListEditorDialog.useCallback[removeRule]"], [
        selectedIdx,
        lists
    ]);
    const handleInputKeyDown = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ListEditorDialog.useCallback[handleInputKeyDown]": (e)=>{
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSuggestionIdx({
                    "ListEditorDialog.useCallback[handleInputKeyDown]": (i)=>Math.min(i + 1, suggestions.length - 1)
                }["ListEditorDialog.useCallback[handleInputKeyDown]"]);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSuggestionIdx({
                    "ListEditorDialog.useCallback[handleInputKeyDown]": (i)=>Math.max(i - 1, -1)
                }["ListEditorDialog.useCallback[handleInputKeyDown]"]);
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (suggestionIdx >= 0 && suggestions[suggestionIdx]) {
                    addRule(suggestions[suggestionIdx]);
                } else {
                    addRule(ruleInput);
                }
            } else if (e.key === "Escape") {
                setShowSuggestions(false);
            }
        }
    }["ListEditorDialog.useCallback[handleInputKeyDown]"], [
        suggestions,
        suggestionIdx,
        ruleInput,
        addRule
    ]);
    const handleNewList = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ListEditorDialog.useCallback[handleNewList]": ()=>{
            if (!newListName.trim()) return;
            const newList = {
                name: newListName.trim(),
                description: newListDesc.trim(),
                rules: []
            };
            const updated = [
                ...lists,
                newList
            ];
            setLists(updated);
            setSelectedIdx(updated.length - 1);
            setShowNewList(false);
            setNewListName("");
            setNewListDesc("");
        }
    }["ListEditorDialog.useCallback[handleNewList]"], [
        newListName,
        newListDesc,
        lists
    ]);
    const handleDeleteList = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ListEditorDialog.useCallback[handleDeleteList]": ()=>{
            if (selectedIdx < 0) return;
            const updated = lists.filter({
                "ListEditorDialog.useCallback[handleDeleteList].updated": (_, i)=>i !== selectedIdx
            }["ListEditorDialog.useCallback[handleDeleteList].updated"]);
            setLists(updated);
            setSelectedIdx(updated.length > 0 ? 0 : -1);
        }
    }["ListEditorDialog.useCallback[handleDeleteList]"], [
        selectedIdx,
        lists
    ]);
    const handleSave = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ListEditorDialog.useCallback[handleSave]": ()=>{
            setProtectionLists(lists);
            log("Protection lists updated");
            onClose();
        }
    }["ListEditorDialog.useCallback[handleSave]"], [
        lists,
        setProtectionLists,
        log,
        onClose
    ]);
    const switchType = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ListEditorDialog.useCallback[switchType]": (t)=>{
            var _inputRef_current;
            setRuleType(t);
            setRuleInput("");
            setSuggestionIdx(-1);
            (_inputRef_current = inputRef.current) === null || _inputRef_current === void 0 ? void 0 : _inputRef_current.focus();
        }
    }["ListEditorDialog.useCallback[switchType]"], []);
    var _selectedList_rules_map_filter;
    // Rules split by type for grouped display
    const prefixRules = (_selectedList_rules_map_filter = selectedList === null || selectedList === void 0 ? void 0 : selectedList.rules.map((r, i)=>({
            rule: r,
            origIdx: i
        })).filter((param)=>{
        let { rule } = param;
        return rule.type === "prefix";
    })) !== null && _selectedList_rules_map_filter !== void 0 ? _selectedList_rules_map_filter : [];
    var _selectedList_rules_map_filter1;
    const exactRules = (_selectedList_rules_map_filter1 = selectedList === null || selectedList === void 0 ? void 0 : selectedList.rules.map((r, i)=>({
            rule: r,
            origIdx: i
        })).filter((param)=>{
        let { rule } = param;
        return rule.type === "exact";
    })) !== null && _selectedList_rules_map_filter1 !== void 0 ? _selectedList_rules_map_filter1 : [];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex w-full max-w-4xl h-175 flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center gap-3 border-b border-border bg-toolbar px-5 py-3.5 shrink-0",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Shield$3e$__["Shield"], {
                            className: "h-4 w-4 text-primary shrink-0"
                        }, void 0, false, {
                            fileName: "[project]/components/list-editor-dialog.tsx",
                            lineNumber: 164,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "min-w-0",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    className: "text-sm font-bold text-foreground leading-none",
                                    children: "Protection Lists"
                                }, void 0, false, {
                                    fileName: "[project]/components/list-editor-dialog.tsx",
                                    lineNumber: 166,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-[11px] text-muted-foreground mt-0.5",
                                    children: "Define which parameters are protected from being overwritten"
                                }, void 0, false, {
                                    fileName: "[project]/components/list-editor-dialog.tsx",
                                    lineNumber: 169,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/list-editor-dialog.tsx",
                            lineNumber: 165,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: onClose,
                            className: "ml-auto rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                className: "h-4 w-4"
                            }, void 0, false, {
                                fileName: "[project]/components/list-editor-dialog.tsx",
                                lineNumber: 177,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/components/list-editor-dialog.tsx",
                            lineNumber: 173,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/list-editor-dialog.tsx",
                    lineNumber: 163,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex flex-1 min-h-0",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex w-55 flex-col border-r border-border bg-background/30 shrink-0",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "px-3 py-2 border-b border-border",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-[10px] uppercase tracking-wider text-muted-foreground font-semibold",
                                        children: "Lists"
                                    }, void 0, false, {
                                        fileName: "[project]/components/list-editor-dialog.tsx",
                                        lineNumber: 185,
                                        columnNumber: 15
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/list-editor-dialog.tsx",
                                    lineNumber: 184,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex-1 overflow-y-auto p-2 flex flex-col gap-1",
                                    children: lists.map((pl, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: ()=>setSelectedIdx(i),
                                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex items-center gap-2 w-full rounded-md px-3 py-2.5 text-left transition-colors border", i === selectedIdx ? "bg-primary/15 border-primary/30 text-foreground" : "border-transparent text-secondary-foreground hover:bg-secondary hover:text-foreground"),
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "flex-1 text-sm font-medium truncate",
                                                    children: pl.name
                                                }, void 0, false, {
                                                    fileName: "[project]/components/list-editor-dialog.tsx",
                                                    lineNumber: 202,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums", i === selectedIdx ? "bg-primary/30 text-primary-foreground" : "bg-secondary text-muted-foreground"),
                                                    children: pl.rules.length
                                                }, void 0, false, {
                                                    fileName: "[project]/components/list-editor-dialog.tsx",
                                                    lineNumber: 205,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, i, true, {
                                            fileName: "[project]/components/list-editor-dialog.tsx",
                                            lineNumber: 192,
                                            columnNumber: 17
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/components/list-editor-dialog.tsx",
                                    lineNumber: 190,
                                    columnNumber: 13
                                }, this),
                                showNewList ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "border-t border-border p-3 flex flex-col gap-2 shrink-0",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            autoFocus: true,
                                            type: "text",
                                            value: newListName,
                                            onChange: (e)=>setNewListName(e.target.value),
                                            onKeyDown: (e)=>{
                                                if (e.key === "Enter") handleNewList();
                                                if (e.key === "Escape") {
                                                    setShowNewList(false);
                                                    setNewListName("");
                                                    setNewListDesc("");
                                                }
                                            },
                                            placeholder: "List name...",
                                            className: "w-full rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                                        }, void 0, false, {
                                            fileName: "[project]/components/list-editor-dialog.tsx",
                                            lineNumber: 222,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: "text",
                                            value: newListDesc,
                                            onChange: (e)=>setNewListDesc(e.target.value),
                                            placeholder: "Description (optional)",
                                            className: "w-full rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                                        }, void 0, false, {
                                            fileName: "[project]/components/list-editor-dialog.tsx",
                                            lineNumber: 238,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex gap-1.5",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    onClick: ()=>{
                                                        setShowNewList(false);
                                                        setNewListName("");
                                                        setNewListDesc("");
                                                    },
                                                    className: "flex-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary transition-colors",
                                                    children: "Cancel"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/list-editor-dialog.tsx",
                                                    lineNumber: 246,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    onClick: handleNewList,
                                                    disabled: !newListName.trim(),
                                                    className: "flex-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30",
                                                    children: "Create"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/list-editor-dialog.tsx",
                                                    lineNumber: 256,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/list-editor-dialog.tsx",
                                            lineNumber: 245,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/list-editor-dialog.tsx",
                                    lineNumber: 221,
                                    columnNumber: 15
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "border-t border-border p-2 flex gap-1.5 shrink-0",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: ()=>setShowNewList(true),
                                            className: "flex-1 flex items-center justify-center gap-1 rounded-md border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                                    className: "h-3.5 w-3.5"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/list-editor-dialog.tsx",
                                                    lineNumber: 271,
                                                    columnNumber: 19
                                                }, this),
                                                "New List"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/list-editor-dialog.tsx",
                                            lineNumber: 267,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: handleDeleteList,
                                            disabled: selectedIdx < 0,
                                            className: "flex items-center justify-center rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-destructive/20 hover:border-destructive hover:text-destructive-foreground transition-colors disabled:opacity-30",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__["Trash2"], {
                                                className: "h-3.5 w-3.5"
                                            }, void 0, false, {
                                                fileName: "[project]/components/list-editor-dialog.tsx",
                                                lineNumber: 279,
                                                columnNumber: 19
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/components/list-editor-dialog.tsx",
                                            lineNumber: 274,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/list-editor-dialog.tsx",
                                    lineNumber: 266,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/list-editor-dialog.tsx",
                            lineNumber: 183,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-1 flex-col min-w-0 overflow-hidden",
                            children: selectedList ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "border-b border-border px-5 py-3.5 shrink-0",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                className: "text-sm font-bold text-foreground",
                                                children: selectedList.name
                                            }, void 0, false, {
                                                fileName: "[project]/components/list-editor-dialog.tsx",
                                                lineNumber: 291,
                                                columnNumber: 19
                                            }, this),
                                            selectedList.description && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "mt-1 text-xs text-muted-foreground leading-relaxed",
                                                children: selectedList.description
                                            }, void 0, false, {
                                                fileName: "[project]/components/list-editor-dialog.tsx",
                                                lineNumber: 295,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/list-editor-dialog.tsx",
                                        lineNumber: 290,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "border-b border-border px-5 py-4 shrink-0",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3",
                                                children: "Add Rule"
                                            }, void 0, false, {
                                                fileName: "[project]/components/list-editor-dialog.tsx",
                                                lineNumber: 303,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center gap-3 mb-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-xs text-muted-foreground w-10 shrink-0",
                                                        children: "Type"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/list-editor-dialog.tsx",
                                                        lineNumber: 309,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex rounded-md border border-border overflow-hidden text-xs font-medium",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                onClick: ()=>switchType("prefix"),
                                                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("px-3 py-1.5 transition-colors", ruleType === "prefix" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"),
                                                                children: "PREFIX"
                                                            }, void 0, false, {
                                                                fileName: "[project]/components/list-editor-dialog.tsx",
                                                                lineNumber: 313,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                onClick: ()=>switchType("exact"),
                                                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("px-3 py-1.5 transition-colors border-l border-border", ruleType === "exact" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"),
                                                                children: "EXACT"
                                                            }, void 0, false, {
                                                                fileName: "[project]/components/list-editor-dialog.tsx",
                                                                lineNumber: 324,
                                                                columnNumber: 23
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/components/list-editor-dialog.tsx",
                                                        lineNumber: 312,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-[11px] text-muted-foreground",
                                                        children: ruleType === "prefix" ? "protects any param whose name starts with this" : "protects only this exact parameter name"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/list-editor-dialog.tsx",
                                                        lineNumber: 336,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/components/list-editor-dialog.tsx",
                                                lineNumber: 308,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center gap-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-xs text-muted-foreground w-10 shrink-0",
                                                        children: "Value"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/list-editor-dialog.tsx",
                                                        lineNumber: 345,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "relative flex-1",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                ref: inputRef,
                                                                type: "text",
                                                                value: ruleInput,
                                                                onChange: (e)=>{
                                                                    setRuleInput(e.target.value);
                                                                    setShowSuggestions(true);
                                                                    setSuggestionIdx(-1);
                                                                },
                                                                onFocus: ()=>setShowSuggestions(true),
                                                                onBlur: ()=>setTimeout(()=>setShowSuggestions(false), 150),
                                                                onKeyDown: handleInputKeyDown,
                                                                placeholder: ruleType === "prefix" ? "e.g. COMPASS_OFS  →  starts with" : "e.g. MOT_THST_HOVER  →  exact name",
                                                                className: "w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-ring"
                                                            }, void 0, false, {
                                                                fileName: "[project]/components/list-editor-dialog.tsx",
                                                                lineNumber: 349,
                                                                columnNumber: 23
                                                            }, this),
                                                            showSuggestions && suggestions.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "absolute left-0 right-0 top-full z-10 mt-1 rounded-md border border-border bg-card shadow-2xl overflow-hidden",
                                                                children: suggestions.map((s, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                        onMouseDown: ()=>addRule(s),
                                                                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex w-full items-center px-3 py-1.5 text-xs font-mono text-left transition-colors", i === suggestionIdx ? "bg-primary/20 text-foreground" : "text-foreground hover:bg-secondary"),
                                                                        children: s
                                                                    }, s, false, {
                                                                        fileName: "[project]/components/list-editor-dialog.tsx",
                                                                        lineNumber: 375,
                                                                        columnNumber: 29
                                                                    }, this))
                                                            }, void 0, false, {
                                                                fileName: "[project]/components/list-editor-dialog.tsx",
                                                                lineNumber: 373,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/components/list-editor-dialog.tsx",
                                                        lineNumber: 348,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        onClick: ()=>addRule(ruleInput),
                                                        disabled: !ruleInput.trim(),
                                                        className: "flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30 shrink-0",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                                                className: "h-3.5 w-3.5"
                                                            }, void 0, false, {
                                                                fileName: "[project]/components/list-editor-dialog.tsx",
                                                                lineNumber: 396,
                                                                columnNumber: 23
                                                            }, this),
                                                            "Add"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/components/list-editor-dialog.tsx",
                                                        lineNumber: 391,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/components/list-editor-dialog.tsx",
                                                lineNumber: 344,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/list-editor-dialog.tsx",
                                        lineNumber: 302,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex-1 overflow-y-auto px-5 py-4 min-h-0",
                                        children: selectedList.rules.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex flex-col items-center justify-center h-full text-center",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Shield$3e$__["Shield"], {
                                                    className: "h-10 w-10 text-muted-foreground/20 mb-3"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/list-editor-dialog.tsx",
                                                    lineNumber: 406,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-sm text-muted-foreground",
                                                    children: "No rules yet"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/list-editor-dialog.tsx",
                                                    lineNumber: 407,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-xs text-muted-foreground/60 mt-1",
                                                    children: "Add prefix or exact rules above to protect parameters"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/list-editor-dialog.tsx",
                                                    lineNumber: 410,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/list-editor-dialog.tsx",
                                            lineNumber: 405,
                                            columnNumber: 21
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "space-y-5",
                                            children: [
                                                prefixRules.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2.5",
                                                            children: [
                                                                "Prefix rules",
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "normal-case ml-1 text-muted-foreground/60",
                                                                    children: "— protects any param starting with"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/components/list-editor-dialog.tsx",
                                                                    lineNumber: 420,
                                                                    columnNumber: 29
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/components/list-editor-dialog.tsx",
                                                            lineNumber: 418,
                                                            columnNumber: 27
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex flex-wrap gap-2",
                                                            children: prefixRules.map((param)=>{
                                                                let { rule, origIdx } = param;
                                                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-mono text-foreground",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: "text-muted-foreground/60 text-[10px]",
                                                                            children: "pre:"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/components/list-editor-dialog.tsx",
                                                                            lineNumber: 430,
                                                                            columnNumber: 33
                                                                        }, this),
                                                                        rule.value,
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                            onClick: ()=>removeRule(origIdx),
                                                                            className: "text-muted-foreground hover:text-destructive-foreground transition-colors ml-0.5",
                                                                            "aria-label": "Remove rule ".concat(rule.value),
                                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                                                                className: "h-3 w-3"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/components/list-editor-dialog.tsx",
                                                                                lineNumber: 439,
                                                                                columnNumber: 35
                                                                            }, this)
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/components/list-editor-dialog.tsx",
                                                                            lineNumber: 434,
                                                                            columnNumber: 33
                                                                        }, this)
                                                                    ]
                                                                }, origIdx, true, {
                                                                    fileName: "[project]/components/list-editor-dialog.tsx",
                                                                    lineNumber: 426,
                                                                    columnNumber: 31
                                                                }, this);
                                                            })
                                                        }, void 0, false, {
                                                            fileName: "[project]/components/list-editor-dialog.tsx",
                                                            lineNumber: 424,
                                                            columnNumber: 27
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/components/list-editor-dialog.tsx",
                                                    lineNumber: 417,
                                                    columnNumber: 25
                                                }, this),
                                                exactRules.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2.5",
                                                            children: [
                                                                "Exact rules",
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "normal-case ml-1 text-muted-foreground/60",
                                                                    children: "— protects this specific parameter"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/components/list-editor-dialog.tsx",
                                                                    lineNumber: 451,
                                                                    columnNumber: 29
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/components/list-editor-dialog.tsx",
                                                            lineNumber: 449,
                                                            columnNumber: 27
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex flex-wrap gap-2",
                                                            children: exactRules.map((param)=>{
                                                                let { rule, origIdx } = param;
                                                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "flex items-center gap-1.5 rounded-md border border-blue-900/40 bg-blue-950/30 px-2.5 py-1 text-xs font-mono text-foreground",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: "text-blue-400/60 text-[10px]",
                                                                            children: "ex:"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/components/list-editor-dialog.tsx",
                                                                            lineNumber: 461,
                                                                            columnNumber: 33
                                                                        }, this),
                                                                        rule.value,
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                            onClick: ()=>removeRule(origIdx),
                                                                            className: "text-muted-foreground hover:text-destructive-foreground transition-colors ml-0.5",
                                                                            "aria-label": "Remove rule ".concat(rule.value),
                                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                                                                className: "h-3 w-3"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/components/list-editor-dialog.tsx",
                                                                                lineNumber: 470,
                                                                                columnNumber: 35
                                                                            }, this)
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/components/list-editor-dialog.tsx",
                                                                            lineNumber: 465,
                                                                            columnNumber: 33
                                                                        }, this)
                                                                    ]
                                                                }, origIdx, true, {
                                                                    fileName: "[project]/components/list-editor-dialog.tsx",
                                                                    lineNumber: 457,
                                                                    columnNumber: 31
                                                                }, this);
                                                            })
                                                        }, void 0, false, {
                                                            fileName: "[project]/components/list-editor-dialog.tsx",
                                                            lineNumber: 455,
                                                            columnNumber: 27
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/components/list-editor-dialog.tsx",
                                                    lineNumber: 448,
                                                    columnNumber: 25
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/list-editor-dialog.tsx",
                                            lineNumber: 415,
                                            columnNumber: 21
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/components/list-editor-dialog.tsx",
                                        lineNumber: 403,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-col items-center justify-center flex-1 gap-2 text-center",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Shield$3e$__["Shield"], {
                                        className: "h-10 w-10 text-muted-foreground/20"
                                    }, void 0, false, {
                                        fileName: "[project]/components/list-editor-dialog.tsx",
                                        lineNumber: 483,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm text-muted-foreground",
                                        children: "Select a list to edit"
                                    }, void 0, false, {
                                        fileName: "[project]/components/list-editor-dialog.tsx",
                                        lineNumber: 484,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/list-editor-dialog.tsx",
                                lineNumber: 482,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/components/list-editor-dialog.tsx",
                            lineNumber: 286,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/list-editor-dialog.tsx",
                    lineNumber: 181,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center justify-between border-t border-border bg-toolbar px-5 py-3 shrink-0",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-xs text-muted-foreground",
                            children: selectedList ? "".concat(selectedList.rules.length, " rule").concat(selectedList.rules.length !== 1 ? "s" : "", " in this list") : ""
                        }, void 0, false, {
                            fileName: "[project]/components/list-editor-dialog.tsx",
                            lineNumber: 494,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex gap-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: onClose,
                                    className: "rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors",
                                    children: "Cancel"
                                }, void 0, false, {
                                    fileName: "[project]/components/list-editor-dialog.tsx",
                                    lineNumber: 500,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: handleSave,
                                    className: "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors",
                                    children: "Save Changes"
                                }, void 0, false, {
                                    fileName: "[project]/components/list-editor-dialog.tsx",
                                    lineNumber: 506,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/list-editor-dialog.tsx",
                            lineNumber: 499,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/list-editor-dialog.tsx",
                    lineNumber: 493,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/list-editor-dialog.tsx",
            lineNumber: 160,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/list-editor-dialog.tsx",
        lineNumber: 159,
        columnNumber: 5
    }, this);
}
_s(ListEditorDialog, "PwPVs408UH/D8FwSLrlAfv3F5Rc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useApp"]
    ];
});
_c = ListEditorDialog;
var _c;
__turbopack_context__.k.register(_c, "ListEditorDialog");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/username-prompt.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "UsernamePrompt",
    ()=>UsernamePrompt
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__User$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/user.js [app-client] (ecmascript) <export default as User>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$user$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/user-store.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
function UsernamePrompt(param) {
    let { onConfirm } = param;
    _s();
    const [value, setValue] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const inputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "UsernamePrompt.useEffect": ()=>{
            var _inputRef_current;
            (_inputRef_current = inputRef.current) === null || _inputRef_current === void 0 ? void 0 : _inputRef_current.focus();
        }
    }["UsernamePrompt.useEffect"], []);
    const sanitized = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$user$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sanitizeUsername"])(value);
    const valid = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$user$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isValidUsername"])(value);
    const showSanitized = valid && sanitized !== value.trim();
    function handleSubmit() {
        if (!valid) return;
        onConfirm(sanitized);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl overflow-hidden",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center gap-2 border-b border-border bg-toolbar px-5 py-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__User$3e$__["User"], {
                            className: "h-4 w-4 text-primary"
                        }, void 0, false, {
                            fileName: "[project]/components/username-prompt.tsx",
                            lineNumber: 33,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            className: "text-sm font-bold text-foreground",
                            children: "Choose a Username"
                        }, void 0, false, {
                            fileName: "[project]/components/username-prompt.tsx",
                            lineNumber: 34,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/username-prompt.tsx",
                    lineNumber: 32,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "p-5 flex flex-col gap-3",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-sm text-muted-foreground",
                            children: "Your protection lists will be saved and synced across devices under your username."
                        }, void 0, false, {
                            fileName: "[project]/components/username-prompt.tsx",
                            lineNumber: 41,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                            ref: inputRef,
                            type: "text",
                            value: value,
                            onChange: (e)=>setValue(e.target.value),
                            onKeyDown: (e)=>e.key === "Enter" && handleSubmit(),
                            placeholder: "e.g. alex or team_alpha",
                            maxLength: 24,
                            className: "rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring font-mono"
                        }, void 0, false, {
                            fileName: "[project]/components/username-prompt.tsx",
                            lineNumber: 45,
                            columnNumber: 11
                        }, this),
                        value.trim() !== "" && !valid && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-xs text-destructive",
                            children: "Must be 2–20 characters: letters, numbers, underscore, dash."
                        }, void 0, false, {
                            fileName: "[project]/components/username-prompt.tsx",
                            lineNumber: 56,
                            columnNumber: 13
                        }, this),
                        showSanitized && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-xs text-muted-foreground",
                            children: [
                                "Will be saved as:",
                                " ",
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "font-mono font-medium text-foreground",
                                    children: sanitized
                                }, void 0, false, {
                                    fileName: "[project]/components/username-prompt.tsx",
                                    lineNumber: 63,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/username-prompt.tsx",
                            lineNumber: 61,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/username-prompt.tsx",
                    lineNumber: 40,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex justify-end border-t border-border bg-toolbar px-5 py-3",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: handleSubmit,
                        disabled: !valid,
                        className: "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30",
                        children: "Continue"
                    }, void 0, false, {
                        fileName: "[project]/components/username-prompt.tsx",
                        lineNumber: 72,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/username-prompt.tsx",
                    lineNumber: 71,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/username-prompt.tsx",
            lineNumber: 30,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/username-prompt.tsx",
        lineNumber: 29,
        columnNumber: 5
    }, this);
}
_s(UsernamePrompt, "l0kJzdQ9IClD0Eh72SyH1Os7Bv4=");
_c = UsernamePrompt;
var _c;
__turbopack_context__.k.register(_c, "UsernamePrompt");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/param-filter-app.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ParamFilterApp",
    ()=>ParamFilterApp
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/refresh-cw.js [app-client] (ecmascript) <export default as RefreshCw>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/file-text.js [app-client] (ecmascript) <export default as FileText>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowLeft$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-left.js [app-client] (ecmascript) <export default as ArrowLeft>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowRight$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-right.js [app-client] (ecmascript) <export default as ArrowRight>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/download.js [app-client] (ecmascript) <export default as Download>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bookmark$2d$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__BookmarkPlus$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/bookmark-plus.js [app-client] (ecmascript) <export default as BookmarkPlus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__User$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/user.js [app-client] (ecmascript) <export default as User>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/app-context.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$param$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/param-engine.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$file$2d$upload$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/file-upload.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$protection$2d$list$2d$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/protection-list-select.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$param$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/param-panel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$detail$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/detail-panel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$console$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/console-panel.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$list$2d$editor$2d$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/list-editor-dialog.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$username$2d$prompt$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/username-prompt.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
;
;
;
;
;
function ParamFilterApp() {
    _s();
    const { username, fileName, protectedParams, remainingParams, checkedProtected, checkedRemaining, pdefGroups, cacheAge, defsLoading, statusMessage, toggleCheckedProtected, toggleCheckedRemaining, toggleAllProtected, toggleAllRemaining, toggleGroupProtected, toggleGroupRemaining, moveCheckedToProtected, moveCheckedToRemaining, selectParam, setParamDefs, setDefsLoading, protectionLists, setProtectionLists, isProtectionModified, setUser, clearUser, log } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useApp"])();
    const [editorOpen, setEditorOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [refreshing, setRefreshing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // "Save selection as list" dialog state
    const [saveListOpen, setSaveListOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [saveListName, setSaveListName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [saveListDesc, setSaveListDesc] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const saveListInputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const openSaveList = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ParamFilterApp.useCallback[openSaveList]": ()=>{
            setSaveListName("");
            setSaveListDesc("");
            setSaveListOpen(true);
            setTimeout({
                "ParamFilterApp.useCallback[openSaveList]": ()=>{
                    var _saveListInputRef_current;
                    return (_saveListInputRef_current = saveListInputRef.current) === null || _saveListInputRef_current === void 0 ? void 0 : _saveListInputRef_current.focus();
                }
            }["ParamFilterApp.useCallback[openSaveList]"], 50);
        }
    }["ParamFilterApp.useCallback[openSaveList]"], []);
    const handleSaveList = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ParamFilterApp.useCallback[handleSaveList]": ()=>{
            if (!saveListName.trim() || protectedParams.length === 0) return;
            const rules = protectedParams.map({
                "ParamFilterApp.useCallback[handleSaveList].rules": (p)=>({
                        type: "exact",
                        value: p.name
                    })
            }["ParamFilterApp.useCallback[handleSaveList].rules"]);
            setProtectionLists([
                ...protectionLists,
                {
                    name: saveListName.trim(),
                    description: saveListDesc.trim(),
                    rules
                }
            ]);
            log("Created protection list '".concat(saveListName.trim(), "' with ").concat(rules.length, " rule(s)"));
            setSaveListOpen(false);
        }
    }["ParamFilterApp.useCallback[handleSaveList]"], [
        saveListName,
        saveListDesc,
        protectedParams,
        protectionLists,
        setProtectionLists,
        log
    ]);
    // Load param definitions on mount
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ParamFilterApp.useEffect": ()=>{
            async function loadDefs() {
                setDefsLoading(true);
                try {
                    const res = await fetch("/api/param-definitions");
                    if (!res.ok) throw new Error("HTTP ".concat(res.status));
                    const data = await res.json();
                    const age = data.fetchedAt ? formatAge(Date.now() - data.fetchedAt) : "just now";
                    setParamDefs(data.params, data.groups, age);
                    log("Definitions loaded — ".concat(Object.keys(data.params).length, " params, ").concat(data.groups.length, " groups"));
                } catch (err) {
                    log("Could not load definitions: ".concat(err.message), "WARN");
                } finally{
                    setDefsLoading(false);
                }
            }
            loadDefs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }
    }["ParamFilterApp.useEffect"], []);
    const handleRefresh = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ParamFilterApp.useCallback[handleRefresh]": async ()=>{
            setRefreshing(true);
            log("Fetching latest parameter definitions from ArduPilot...");
            try {
                const res = await fetch("/api/param-definitions?force");
                if (!res.ok) throw new Error("HTTP ".concat(res.status));
                const data = await res.json();
                setParamDefs(data.params, data.groups, "just now");
                log("Definitions updated — ".concat(Object.keys(data.params).length, " params, ").concat(data.groups.length, " groups"));
            } catch (err) {
                log("Fetch failed: ".concat(err.message), "ERROR");
            } finally{
                setRefreshing(false);
            }
        }
    }["ParamFilterApp.useCallback[handleRefresh]"], [
        log,
        setParamDefs
    ]);
    const handleSave = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ParamFilterApp.useCallback[handleSave]": ()=>{
            if (remainingParams.length === 0) return;
            const content = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$param$2d$engine$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["writeParamFile"])(remainingParams);
            const blob = new Blob([
                content
            ], {
                type: "text/plain"
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            const baseName = fileName ? fileName.replace(/\.\w+$/, "") : "params";
            a.href = url;
            a.download = "".concat(baseName, "_filtered.param");
            a.click();
            URL.revokeObjectURL(url);
            log("Saved '".concat(baseName, "_filtered.param' — ").concat(remainingParams.length, " written, ").concat(protectedParams.length, " removed"));
        }
    }["ParamFilterApp.useCallback[handleSave]"], [
        remainingParams,
        protectedParams,
        fileName,
        log
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex h-screen flex-col overflow-hidden",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "flex items-center gap-4 border-b border-border bg-toolbar px-4 py-2.5 shrink-0 flex-wrap",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$file$2d$upload$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FileUpload"], {}, void 0, false, {
                        fileName: "[project]/components/param-filter-app.tsx",
                        lineNumber: 143,
                        columnNumber: 9
                    }, this),
                    fileName && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-1.5 text-sm text-foreground",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"], {
                                className: "h-4 w-4 text-muted-foreground"
                            }, void 0, false, {
                                fileName: "[project]/components/param-filter-app.tsx",
                                lineNumber: 146,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-medium",
                                children: fileName
                            }, void 0, false, {
                                fileName: "[project]/components/param-filter-app.tsx",
                                lineNumber: 147,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/param-filter-app.tsx",
                        lineNumber: 145,
                        columnNumber: 11
                    }, this),
                    username && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-1.5 text-xs text-muted-foreground",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__User$3e$__["User"], {
                                className: "h-3.5 w-3.5"
                            }, void 0, false, {
                                fileName: "[project]/components/param-filter-app.tsx",
                                lineNumber: 153,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-mono font-medium text-foreground",
                                children: username
                            }, void 0, false, {
                                fileName: "[project]/components/param-filter-app.tsx",
                                lineNumber: 154,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: clearUser,
                                className: "hover:text-foreground transition-colors",
                                title: "Change username",
                                children: "· change"
                            }, void 0, false, {
                                fileName: "[project]/components/param-filter-app.tsx",
                                lineNumber: 157,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/param-filter-app.tsx",
                        lineNumber: 152,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex-1"
                    }, void 0, false, {
                        fileName: "[project]/components/param-filter-app.tsx",
                        lineNumber: 166,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$protection$2d$list$2d$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ProtectionListSelect"], {
                        onEditLists: ()=>setEditorOpen(true)
                    }, void 0, false, {
                        fileName: "[project]/components/param-filter-app.tsx",
                        lineNumber: 167,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: handleRefresh,
                        disabled: refreshing,
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-primary-foreground transition-colors", "bg-[#2d5a27] hover:bg-[#3a7232] disabled:opacity-50"),
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__["RefreshCw"], {
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("h-4 w-4", refreshing && "animate-spin")
                            }, void 0, false, {
                                fileName: "[project]/components/param-filter-app.tsx",
                                lineNumber: 176,
                                columnNumber: 11
                            }, this),
                            refreshing ? "Fetching..." : "Refresh Params"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/param-filter-app.tsx",
                        lineNumber: 168,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/param-filter-app.tsx",
                lineNumber: 142,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-1 min-h-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col flex-1 min-w-0 p-2",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$param$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ParamPanel"], {
                            title: "PROTECTED — will be removed",
                            headerColor: "bg-protected-header",
                            params: protectedParams,
                            checkedNames: checkedProtected,
                            pdefGroups: pdefGroups,
                            onToggleCheck: toggleCheckedProtected,
                            onToggleAll: toggleAllProtected,
                            onToggleGroup: toggleGroupProtected,
                            onSelectParam: selectParam,
                            headerAction: isProtectionModified ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: openSaveList,
                                className: "flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-foreground/80 hover:bg-black/20 transition-colors whitespace-nowrap",
                                title: "Save the current protected params as a new protection list",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bookmark$2d$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__BookmarkPlus$3e$__["BookmarkPlus"], {
                                        className: "h-3.5 w-3.5"
                                    }, void 0, false, {
                                        fileName: "[project]/components/param-filter-app.tsx",
                                        lineNumber: 204,
                                        columnNumber: 19
                                    }, void 0),
                                    "Save as list"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/param-filter-app.tsx",
                                lineNumber: 199,
                                columnNumber: 17
                            }, void 0) : undefined
                        }, void 0, false, {
                            fileName: "[project]/components/param-filter-app.tsx",
                            lineNumber: 187,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/param-filter-app.tsx",
                        lineNumber: 186,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col items-center justify-center gap-3 px-1 py-4 shrink-0",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: moveCheckedToProtected,
                                disabled: checkedRemaining.size === 0,
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex w-16 flex-col items-center justify-center rounded-lg py-3 text-xs font-bold transition-colors", "bg-protected-header text-foreground hover:bg-[#8b3a3a] disabled:opacity-30 disabled:cursor-not-allowed"),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowLeft$3e$__["ArrowLeft"], {
                                        className: "h-5 w-5"
                                    }, void 0, false, {
                                        fileName: "[project]/components/param-filter-app.tsx",
                                        lineNumber: 222,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "mt-0.5",
                                        children: "Protect"
                                    }, void 0, false, {
                                        fileName: "[project]/components/param-filter-app.tsx",
                                        lineNumber: 223,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/param-filter-app.tsx",
                                lineNumber: 214,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: moveCheckedToRemaining,
                                disabled: checkedProtected.size === 0,
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex w-16 flex-col items-center justify-center rounded-lg py-3 text-xs font-bold transition-colors", "bg-applied-header text-foreground hover:bg-[#3a7232] disabled:opacity-30 disabled:cursor-not-allowed"),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "mb-0.5",
                                        children: "Apply"
                                    }, void 0, false, {
                                        fileName: "[project]/components/param-filter-app.tsx",
                                        lineNumber: 233,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowRight$3e$__["ArrowRight"], {
                                        className: "h-5 w-5"
                                    }, void 0, false, {
                                        fileName: "[project]/components/param-filter-app.tsx",
                                        lineNumber: 234,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/param-filter-app.tsx",
                                lineNumber: 225,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/param-filter-app.tsx",
                        lineNumber: 213,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col flex-1 min-w-0 p-2",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$param$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ParamPanel"], {
                            title: "WILL BE APPLIED",
                            headerColor: "bg-applied-header",
                            params: remainingParams,
                            checkedNames: checkedRemaining,
                            pdefGroups: pdefGroups,
                            onToggleCheck: toggleCheckedRemaining,
                            onToggleAll: toggleAllRemaining,
                            onToggleGroup: toggleGroupRemaining,
                            onSelectParam: selectParam
                        }, void 0, false, {
                            fileName: "[project]/components/param-filter-app.tsx",
                            lineNumber: 240,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/param-filter-app.tsx",
                        lineNumber: 239,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "hidden lg:flex lg:flex-col flex-1 min-w-0 m-2 rounded-lg border border-border bg-card overflow-hidden",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "border-b border-border px-3 py-2",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                    className: "text-xs font-semibold text-foreground",
                                    children: "Parameter Info"
                                }, void 0, false, {
                                    fileName: "[project]/components/param-filter-app.tsx",
                                    lineNumber: 256,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/param-filter-app.tsx",
                                lineNumber: 255,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex-1 min-h-0 overflow-hidden",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$detail$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DetailPanel"], {}, void 0, false, {
                                    fileName: "[project]/components/param-filter-app.tsx",
                                    lineNumber: 261,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/param-filter-app.tsx",
                                lineNumber: 260,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/param-filter-app.tsx",
                        lineNumber: 254,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/param-filter-app.tsx",
                lineNumber: 184,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-col shrink-0 border-t border-border",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "h-35",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$console$2d$panel$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ConsolePanel"], {}, void 0, false, {
                            fileName: "[project]/components/param-filter-app.tsx",
                            lineNumber: 269,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/param-filter-app.tsx",
                        lineNumber: 268,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between border-t border-border bg-toolbar px-4 py-1.5",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: handleSave,
                                        disabled: remainingParams.length === 0,
                                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors", "bg-primary hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed"),
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__["Download"], {
                                                className: "h-3.5 w-3.5"
                                            }, void 0, false, {
                                                fileName: "[project]/components/param-filter-app.tsx",
                                                lineNumber: 281,
                                                columnNumber: 15
                                            }, this),
                                            "Save Filtered File"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/param-filter-app.tsx",
                                        lineNumber: 273,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-xs text-muted-foreground",
                                        children: statusMessage
                                    }, void 0, false, {
                                        fileName: "[project]/components/param-filter-app.tsx",
                                        lineNumber: 284,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/param-filter-app.tsx",
                                lineNumber: 272,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-[10px] text-muted-foreground",
                                children: [
                                    "Cache: ",
                                    defsLoading ? "loading..." : cacheAge
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/param-filter-app.tsx",
                                lineNumber: 288,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/param-filter-app.tsx",
                        lineNumber: 271,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/param-filter-app.tsx",
                lineNumber: 267,
                columnNumber: 7
            }, this),
            editorOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$list$2d$editor$2d$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ListEditorDialog"], {
                onClose: ()=>setEditorOpen(false)
            }, void 0, false, {
                fileName: "[project]/components/param-filter-app.tsx",
                lineNumber: 296,
                columnNumber: 9
            }, this),
            username === null && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$username$2d$prompt$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["UsernamePrompt"], {
                onConfirm: setUser
            }, void 0, false, {
                fileName: "[project]/components/param-filter-app.tsx",
                lineNumber: 300,
                columnNumber: 29
            }, this),
            saveListOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "w-full max-w-md rounded-xl border border-border bg-card shadow-2xl overflow-hidden",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center justify-between border-b border-border bg-toolbar px-5 py-3.5",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center gap-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bookmark$2d$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__BookmarkPlus$3e$__["BookmarkPlus"], {
                                            className: "h-4 w-4 text-primary"
                                        }, void 0, false, {
                                            fileName: "[project]/components/param-filter-app.tsx",
                                            lineNumber: 309,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                            className: "text-sm font-bold text-foreground",
                                            children: "Save Selection as Protection List"
                                        }, void 0, false, {
                                            fileName: "[project]/components/param-filter-app.tsx",
                                            lineNumber: 310,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/param-filter-app.tsx",
                                    lineNumber: 308,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: ()=>setSaveListOpen(false),
                                    className: "rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                        className: "h-4 w-4"
                                    }, void 0, false, {
                                        fileName: "[project]/components/param-filter-app.tsx",
                                        lineNumber: 318,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/param-filter-app.tsx",
                                    lineNumber: 314,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/param-filter-app.tsx",
                            lineNumber: 307,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "p-5 flex flex-col gap-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col gap-1.5",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "text-xs font-semibold text-muted-foreground uppercase tracking-wider",
                                            children: "Name"
                                        }, void 0, false, {
                                            fileName: "[project]/components/param-filter-app.tsx",
                                            lineNumber: 325,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            ref: saveListInputRef,
                                            type: "text",
                                            value: saveListName,
                                            onChange: (e)=>setSaveListName(e.target.value),
                                            onKeyDown: (e)=>e.key === "Enter" && handleSaveList(),
                                            placeholder: "e.g. Battery Parameters",
                                            className: "rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                                        }, void 0, false, {
                                            fileName: "[project]/components/param-filter-app.tsx",
                                            lineNumber: 328,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/param-filter-app.tsx",
                                    lineNumber: 324,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col gap-1.5",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "text-xs font-semibold text-muted-foreground uppercase tracking-wider",
                                            children: [
                                                "Description",
                                                " ",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "normal-case text-muted-foreground/60 font-normal",
                                                    children: "(optional)"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/param-filter-app.tsx",
                                                    lineNumber: 343,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/param-filter-app.tsx",
                                            lineNumber: 341,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: "text",
                                            value: saveListDesc,
                                            onChange: (e)=>setSaveListDesc(e.target.value),
                                            placeholder: "A short description",
                                            className: "rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                                        }, void 0, false, {
                                            fileName: "[project]/components/param-filter-app.tsx",
                                            lineNumber: 347,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/param-filter-app.tsx",
                                    lineNumber: 340,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex flex-col gap-1.5",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "text-xs font-semibold text-muted-foreground uppercase tracking-wider",
                                            children: [
                                                protectedParams.length,
                                                " exact rule",
                                                protectedParams.length !== 1 ? "s" : "",
                                                " will be created"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/param-filter-app.tsx",
                                            lineNumber: 358,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "rounded-md border border-border bg-background/50 px-3 py-2 max-h-36 overflow-y-auto",
                                            children: [
                                                protectedParams.slice(0, 8).map((p)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "font-mono text-xs text-foreground py-0.5",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-muted-foreground/60 mr-1.5",
                                                                children: "ex:"
                                                            }, void 0, false, {
                                                                fileName: "[project]/components/param-filter-app.tsx",
                                                                lineNumber: 365,
                                                                columnNumber: 23
                                                            }, this),
                                                            p.name
                                                        ]
                                                    }, p.name, true, {
                                                        fileName: "[project]/components/param-filter-app.tsx",
                                                        lineNumber: 364,
                                                        columnNumber: 21
                                                    }, this)),
                                                protectedParams.length > 8 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-xs text-muted-foreground italic pt-1",
                                                    children: [
                                                        "…and ",
                                                        protectedParams.length - 8,
                                                        " more"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/components/param-filter-app.tsx",
                                                    lineNumber: 370,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/param-filter-app.tsx",
                                            lineNumber: 362,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/param-filter-app.tsx",
                                    lineNumber: 357,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/param-filter-app.tsx",
                            lineNumber: 322,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center justify-end gap-2 border-t border-border bg-toolbar px-5 py-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: ()=>setSaveListOpen(false),
                                    className: "rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors",
                                    children: "Cancel"
                                }, void 0, false, {
                                    fileName: "[project]/components/param-filter-app.tsx",
                                    lineNumber: 380,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: handleSaveList,
                                    disabled: !saveListName.trim(),
                                    className: "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30",
                                    children: "Create List"
                                }, void 0, false, {
                                    fileName: "[project]/components/param-filter-app.tsx",
                                    lineNumber: 386,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/param-filter-app.tsx",
                            lineNumber: 379,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/param-filter-app.tsx",
                    lineNumber: 305,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/param-filter-app.tsx",
                lineNumber: 304,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/param-filter-app.tsx",
        lineNumber: 140,
        columnNumber: 5
    }, this);
}
_s(ParamFilterApp, "A+9qOI4TIj4J6aXGIlHgjyDSJSU=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$app$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useApp"]
    ];
});
_c = ParamFilterApp;
function formatAge(ms) {
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return "".concat(sec, "s ago");
    if (sec < 3600) return "".concat(Math.floor(sec / 60), "m ago");
    const h = Math.floor(sec / 3600);
    const m = Math.floor(sec % 3600 / 60);
    return "".concat(h, "h ").concat(m, "m ago");
}
var _c;
__turbopack_context__.k.register(_c, "ParamFilterApp");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=_de08f4c3._.js.map