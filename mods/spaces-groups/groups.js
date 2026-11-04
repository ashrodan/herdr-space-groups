// Space groups: pure logic, no "herdr" import, so node:test can load it.
//
// Config (groups.json in this mod's folder; all fields optional):
//   { "auto": true,                 group spaces whose names share a prefix
//     "separators": "-_.",          where a name prefix ends
//     "min": 2,                     spaces needed for an automatic group
//     "groups": { "globex": ["globex-*"], "clients": ["acme-api", "acme-web"] },
//     "ignore": ["~"] }             names never grouped
// A pattern is a space name; "*" matches any run of characters. Case is ignored.
// Explicit groups win over automatic ones; the first explicit group that matches wins.

export const DEFAULTS = { auto: true, separators: "-_.", min: 2, groups: {}, ignore: ["~"] };

export function config(raw) {
  let c = {};
  if (typeof raw === "string" && raw.trim()) {
    try { c = JSON.parse(raw); } catch (e) { return { ...DEFAULTS, error: `groups.json: ${e.message}` }; }
  } else if (raw && typeof raw === "object") c = raw;
  const out = { ...DEFAULTS, ...c };
  if (typeof out.groups !== "object" || Array.isArray(out.groups) || !out.groups) out.groups = {};
  if (!Array.isArray(out.ignore)) out.ignore = DEFAULTS.ignore;
  if (!Number.isFinite(out.min) || out.min < 2) out.min = 2;
  if (typeof out.separators !== "string" || !out.separators) out.separators = DEFAULTS.separators;
  return out;
}

const esc = (s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
export const matches = (pattern, name) =>
  new RegExp(`^${String(pattern).split("*").map(esc).join(".*")}$`, "i").test(name);

// The automatic group key of a name: the text before the first separator,
// when there is text on both sides ("globex-shop" → "globex"; "globex" → null).
export function prefix(name, separators = DEFAULTS.separators) {
  const n = String(name ?? "");
  for (let i = 1; i < n.length - 1; i++) if (separators.includes(n[i])) return n.slice(0, i);
  return null;
}

// Which group each top-level name belongs to: Map name → group label.
export function assign(names, cfg = DEFAULTS) {
  const c = config(cfg);
  const out = new Map();
  const free = [];
  for (const name of names) {
    if (c.ignore.some((p) => matches(p, name))) continue;
    const hit = Object.entries(c.groups).find(([, pats]) => [].concat(pats).some((p) => matches(p, name)));
    if (hit) out.set(name, hit[0]);
    else free.push(name);
  }
  if (c.auto) {
    const by = new Map();
    for (const name of free) {
      const p = prefix(name, c.separators);
      if (!p) continue;
      const k = p.toLowerCase();
      if (!by.has(k)) by.set(k, { label: p, names: [] });
      by.get(k).names.push(name);
    }
    const explicit = new Set(Object.keys(c.groups).map((k) => k.toLowerCase()));
    for (const [k, { label, names: ns }] of by) {
      if (ns.length < c.min && !explicit.has(k)) continue;
      const to = explicit.has(k) ? Object.keys(c.groups).find((g) => g.toLowerCase() === k) : label;
      for (const n of ns) out.set(n, to);
    }
  }
  return out;
}

// Rows of one machine (already ordered, worktree rows with `tree` set right after
// their main row) → items: { kind: "row", row } or { kind: "group", label, rows }.
// A group sits where its first member was; its members keep their order and take
// their worktree rows with them. `name(row)` gives a row's space name.
export function layout(rows, cfg, name = (r) => r.w.name) {
  const units = [];
  for (const r of rows) {
    if (r.tree && units.length) units[units.length - 1].push(r);
    else units.push([r]);
  }
  const of = assign(units.map((u) => name(u[0])), cfg);
  const items = [];
  const at = new Map();
  for (const u of units) {
    const label = of.get(name(u[0]));
    if (!label) { for (const r of u) items.push({ kind: "row", row: r }); continue; }
    if (!at.has(label)) { at.set(label, items.length); items.push({ kind: "group", label, rows: [] }); }
    items[at.get(label)].rows.push(...u);
  }
  return items;
}

const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
// The most urgent status in a group: blocked > done > working > idle.
export function urgent(statuses) {
  let best = null;
  for (const s of statuses) if ((RANK[s] ?? 0) > (RANK[best] ?? 0)) best = s;
  return best;
}
