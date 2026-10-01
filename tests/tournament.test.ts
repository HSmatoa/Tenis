import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyState,
  applyAction,
  getMatches,
  standings,
  demoState,
  type TournamentState,
} from "../lib/tennis/tournament.ts";
function registered(n: number) {
  let s = emptyState();
  for (let i = 0; i < n; i++)
    s = applyAction(s, {
      type: "add",
      category: "women",
      player1: `Anna ${i}`,
      player2: `Eva ${i}`,
    });
  return s;
}
function started(n: number) {
  return applyAction(registered(n), { type: "start", category: "women" });
}
function win(
  s: TournamentState,
  id: string,
  winnerId: string,
  score = "6:2, 6:3",
) {
  return applyAction(s, {
    type: "result",
    category: "women",
    matchId: id,
    winnerId,
    score,
  });
}
for (const n of [2, 3, 4, 5, 6, 7, 8])
  test(`${n} teams finish with one champion and ${n - 1} played matches`, () => {
    let s = started(n),
      played = 0;
    while (true) {
      const m = getMatches(s.women).find(
        (m) => m.ready && !m.bye && !m.winnerId,
      );
      if (!m) break;
      s = win(s, m.id, m.teamAId!);
      played++;
      assert.ok(played < 8);
    }
    assert.equal(played, n - 1);
    assert.ok(getMatches(s.women).at(-1)!.winnerId);
    assert.equal(standings(s.women).filter((r) => r.place === 1).length, 1);
    assert.equal(
      standings(s.women).reduce((a: number, r) => a + r.points, 0),
      2 * (n - 1),
    );
  });
test("registration validates names and capacity; categories are isolated", () => {
  let s = registered(8);
  assert.equal(s.men.teams.length, 0);
  assert.throws(() =>
    applyAction(s, {
      type: "add",
      category: "women",
      player1: "x",
      player2: "y",
    }),
  );
  for (const name of ["", "   ", "x".repeat(101)])
    assert.throws(() =>
      applyAction(emptyState(), {
        type: "add",
        category: "men",
        player1: name,
        player2: "y",
      }),
    );
  assert.throws(() =>
    applyAction(emptyState(), { type: "start", category: "men" }),
  );
  s = applyAction(s, { type: "start", category: "women" });
  assert.throws(() =>
    applyAction(s, {
      type: "remove",
      category: "women",
      teamId: s.women.teams[0].id,
    }),
  );
});
test("renaming a progressed team preserves identity and points", () => {
  let s = started(2);
  const m = getMatches(s.women)[0];
  s = win(s, m.id, m.teamAId!);
  const id = m.teamAId!;
  s = applyAction(s, {
    type: "rename",
    category: "women",
    teamId: id,
    player1: "Nová Anna",
    player2: "Nová Eva",
  });
  assert.equal(getMatches(s.women)[0].winnerId, id);
  assert.equal(standings(s.women)[0].points, 2);
  assert.equal(s.women.teams.find((t) => t.id === id)!.player1, "Nová Anna");
});
test("score correction and repeated saves do not duplicate points", () => {
  let s = started(2);
  const m = getMatches(s.women)[0];
  s = win(s, m.id, m.teamAId!);
  s = win(s, m.id, m.teamAId!, "7:5");
  s = win(s, m.id, m.teamAId!, "7:5");
  assert.equal(standings(s.women)[0].points, 2);
  assert.equal(getMatches(s.women)[0].score, "7:5");
});
test("winner correction clears only dependent results", () => {
  let s = started(8);
  for (const round of [0, 1, 2])
    for (const m of getMatches(s.women).filter((m) => m.round === round))
      s = win(s, m.id, m.teamAId!);
  const before = getMatches(s.women),
    q = before[0],
    otherSemi = before.find((m) => m.id === "1-1");
  s = win(s, q.id, q.teamBId!);
  const after = getMatches(s.women);
  assert.equal(after.find((m) => m.id === "1-0")!.winnerId, null);
  assert.equal(after.at(-1)!.winnerId, null);
  assert.equal(
    after.find((m) => m.id === "1-1")!.winnerId,
    otherSemi!.winnerId,
  );
  assert.equal(
    standings(s.women).reduce((a: number, r) => a + r.points, 0),
    10,
  );
});
test("refuses pending, bye, unknown and invalid winners", () => {
  const s = started(3);
  for (const m of getMatches(s.women).filter((m) => !m.ready || m.bye))
    assert.throws(() => win(s, m.id, s.women.teams[0].id));
  assert.throws(() => win(s, "nonsense", "x"));
  const m = getMatches(s.women).find((m) => m.ready && !m.bye);
  assert.throws(() => win(s, m!.id, "outsider"));
});
test("losing semifinalists share third place", () => {
  let s = started(4);
  for (const r of [0, 1])
    for (const m of getMatches(s.women).filter((m) => m.round === r))
      s = win(s, m.id, m.teamAId!);
  assert.deepEqual(
    standings(s.women).map((r) => r.place),
    [1, 2, 3, 3],
  );
});
test("demo reset uses fictional teams and blank reset clears both categories", () => {
  const d = demoState();
  assert.equal(d.women.teams.length, 8);
  assert.equal(d.men.teams.length, 8);
  const blank = applyAction(d, { type: "reset", mode: "empty" });
  assert.equal(blank.women.teams.length, 0);
  assert.equal(blank.men.teams.length, 0);
});
