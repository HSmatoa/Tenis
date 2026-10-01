import {
  applyAction,
  demoState,
  type Action,
  type TournamentState,
} from "./tournament.ts";
interface Row {
  state: string;
  version: number;
}
export interface Store {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first(): Promise<unknown>;
      run(): Promise<{ meta: { changes: number } }>;
    };
    first(): Promise<unknown>;
  };
}
export class ConflictError extends Error {
  constructor() {
    super(
      "Turnaj mezitím někdo změnil. Načtěte aktuální stav a zkuste úpravu znovu.",
    );
  }
}
export async function loadTournament(db: Store): Promise<TournamentState> {
  let row = (await db
    .prepare("SELECT state, version FROM tournament WHERE id = 'demo'")
    .first()) as Row | null;
  if (!row) {
    const s = demoState();
    await db
      .prepare(
        "INSERT OR IGNORE INTO tournament (id, state, version) VALUES ('demo', ?, 0)",
      )
      .bind(JSON.stringify(s))
      .run();
    row = (await db
      .prepare("SELECT state, version FROM tournament WHERE id = 'demo'")
      .first()) as Row;
  }
  return { ...JSON.parse(row.state), version: row.version };
}
export async function mutateTournament(
  db: Store,
  version: number,
  action: Action,
): Promise<TournamentState> {
  if (!Number.isSafeInteger(version) || version < 0)
    throw new Error("Neplatná verze turnaje.");
  const current = await loadTournament(db);
  if (current.version !== version) throw new ConflictError();
  const next = applyAction(current, action);
  next.version = version + 1;
  const result = await db
    .prepare(
      "UPDATE tournament SET state = ?, version = ? WHERE id = 'demo' AND version = ?",
    )
    .bind(JSON.stringify(next), next.version, version)
    .run();
  if (result.meta.changes !== 1) throw new ConflictError();
  return next;
}
