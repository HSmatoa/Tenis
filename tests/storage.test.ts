import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { loadTournament, mutateTournament } from "../lib/tennis/storage.ts";
function db() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(
    "CREATE TABLE tournament (id TEXT PRIMARY KEY, state TEXT NOT NULL, version INTEGER NOT NULL)",
  );
  return {
    prepare(query: string) {
      let params: SQLInputValue[] = [];
      return {
        bind(...p: SQLInputValue[]) {
          params = p;
          return this;
        },
        async first() {
          return sql.prepare(query).get(...params) ?? null;
        },
        async run() {
          const r = sql.prepare(query).run(...params);
          return { meta: { changes: Number(r.changes) } };
        },
      };
    },
  };
}
test("stored demo survives reload and stale mutation cannot overwrite it", async () => {
  const d = db(),
    initial = await loadTournament(d);
  assert.equal(initial.women.teams.length, 8);
  const blank = await mutateTournament(d, initial.version, {
    type: "reset",
    mode: "empty",
  });
  assert.equal(blank.version, 1);
  const added = await mutateTournament(d, 1, {
    type: "add",
    category: "women",
    player1: "Anna",
    player2: "Eva",
  });
  assert.equal(added.version, 2);
  await assert.rejects(
    mutateTournament(d, 1, { type: "reset", mode: "demo" }),
    /někdo změnil/,
  );
  const reload = await loadTournament(d);
  assert.equal(reload.women.teams.length, 1);
  assert.equal(reload.men.teams.length, 0);
  assert.equal(reload.version, 2);
});
test("invalid action does not mutate stored state", async () => {
  const d = db(),
    s = await loadTournament(d);
  await assert.rejects(
    mutateTournament(d, s.version, {
      type: "add",
      category: "invalid" as never,
      player1: "a",
      player2: "b",
    }),
  );
  assert.deepEqual(await loadTournament(d), s);
});
test("database write failure is propagated", async () => {
  const d = db();
  await loadTournament(d);
  const broken = {
    prepare(q: string) {
      const stmt = d.prepare(q);
      if (q.startsWith("UPDATE"))
        stmt.run = async () => {
          throw new Error("write failed");
        };
      return stmt;
    },
  };
  await assert.rejects(
    mutateTournament(broken, 0, { type: "reset", mode: "empty" }),
    /write failed/,
  );
  assert.equal((await loadTournament(d)).women.teams.length, 8);
});
