import test from "node:test";
import assert from "node:assert/strict";
import { config, matches, prefix, assign, layout, urgent } from "../mods/spaces-groups/groups.js";

const row = (name, tree = null) => ({ w: { name }, tree });
const names = (items) => items.map((i) => (i.kind === "row" ? i.row.w.name : `[${i.label}: ${i.rows.map((r) => r.w.name).join(", ")}]`));

test("prefix ends at the first separator with text on both sides", () => {
  assert.equal(prefix("globex-shop"), "globex");
  assert.equal(prefix("blog-site"), "blog");
  assert.equal(prefix("ship_it"), "ship");
  assert.equal(prefix("globex"), null);
  assert.equal(prefix("-x"), null);
  assert.equal(prefix("x-"), null);
  assert.equal(prefix("~"), null);
});

test("matches: * and case", () => {
  assert.ok(matches("globex-*", "GLOBEX-shop"));
  assert.ok(matches("a.b", "a.b"));
  assert.ok(!matches("a.b", "axb"));
  assert.ok(!matches("globex-*", "my-globex-shop"));
});

test("auto groups need at least min names", () => {
  const m = assign(["globex-shop", "globex-app", "ship-it", "notes-app", "~"]);
  assert.equal(m.get("globex-shop"), "globex");
  assert.equal(m.get("globex-app"), "globex");
  assert.equal(m.has("ship-it"), false);
  assert.equal(m.has("~"), false);
});

test("explicit groups win, and a lone member still forms its group", () => {
  const m = assign(["acme-api", "web", "globex-shop", "globex-app"], { groups: { clients: ["acme-*", "web"] } });
  assert.equal(m.get("acme-api"), "clients");
  assert.equal(m.get("web"), "clients");
  assert.equal(m.get("globex-shop"), "globex");
  const one = assign(["globex-shop"], { groups: { globex: [] } });
  assert.equal(one.get("globex-shop"), "globex");
});

test("auto off and ignore", () => {
  assert.equal(assign(["a-1", "a-2"], { auto: false }).size, 0);
  assert.equal(assign(["a-1", "a-2"], { ignore: ["a-*"] }).size, 0);
});

test("layout keeps order, pulls members together, carries worktrees", () => {
  const rows = [row("~"), row("blog-site"), row("seo-pass", "├─"), row("drafts-v2", "└─"),
    row("globex-shop"), row("notes"), row("globex-app"), row("blog-drafts")];
  assert.deepEqual(names(layout(rows, {})), [
    "~",
    "[blog: blog-site, seo-pass, drafts-v2, blog-drafts]",
    "[globex: globex-shop, globex-app]",
    "notes",
  ]);
});

test("config survives bad input", () => {
  assert.match(config("{nope").error, /groups.json/);
  assert.deepEqual(config(null).groups, {});
  assert.equal(config({ min: 0 }).min, 2);
});

test("urgent", () => {
  assert.equal(urgent(["idle", "done", "working"]), "done");
  assert.equal(urgent(["idle", "blocked"]), "blocked");
  assert.equal(urgent([undefined]), null);
});
