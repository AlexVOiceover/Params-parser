module.exports = [
"[project]/.next-internal/server/app/api/lists/[username]/route/actions.js [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__, module, exports) => {

}),
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[project]/lib/param-engine.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
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
    return params.map((p)=>`${p.name},${p.value}`).join("\n") + "\n";
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
    return Object.entries(map).sort(([a], [b])=>a.localeCompare(b)).map(([label, params])=>({
            label,
            params
        }));
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
}),
"[project]/app/api/lists/[username]/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "PUT",
    ()=>PUT
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$param$2d$engine$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/param-engine.ts [app-route] (ecmascript)");
;
;
function kvKey(username) {
    return `lists:${username.toLowerCase()}`;
}
async function GET(_req, { params }) {
    const { username } = await params;
    try {
        const { kv } = await __turbopack_context__.A("[project]/node_modules/@vercel/kv/dist/index.js [app-route] (ecmascript, async loader)");
        const data = await kv.get(kvKey(username));
        if (!data || data.length === 0) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                lists: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$param$2d$engine$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DEFAULT_PROTECTION_LISTS"],
                source: "defaults"
            });
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            lists: data,
            source: "kv"
        });
    } catch (err) {
        console.error("[lists/GET] KV error:", err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            lists: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$param$2d$engine$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DEFAULT_PROTECTION_LISTS"],
            source: "error",
            error: String(err)
        });
    }
}
async function PUT(req, { params }) {
    const { username } = await params;
    try {
        const lists = await req.json();
        const { kv } = await __turbopack_context__.A("[project]/node_modules/@vercel/kv/dist/index.js [app-route] (ecmascript, async loader)");
        await kv.set(kvKey(username), lists);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: true
        });
    } catch (err) {
        console.error("[lists/PUT] KV error:", err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: false,
            error: String(err)
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__419e6e58._.js.map