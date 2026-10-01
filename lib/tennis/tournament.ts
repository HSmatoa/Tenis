export type CategoryKey = "women" | "men";
export interface Team {
  id: string;
  player1: string;
  player2: string;
}
export interface Result {
  winnerId: string;
  score: string;
  pair: [string, string];
}
export interface Category {
  teams: Team[];
  started: boolean;
  results: Record<string, Result>;
}
export interface TournamentState {
  women: Category;
  men: Category;
  version: number;
}
export interface Match {
  id: string;
  round: number;
  slot: number;
  teamAId: string | null;
  teamBId: string | null;
  ready: boolean;
  bye: boolean;
  winnerId: string | null;
  score: string;
}
export type Action =
  | { type: "reset"; mode: "demo" | "empty" }
  | { type: "add"; category: CategoryKey; player1: string; player2: string }
  | {
      type: "rename";
      category: CategoryKey;
      teamId: string;
      player1: string;
      player2: string;
    }
  | { type: "remove"; category: CategoryKey; teamId: string }
  | { type: "start"; category: CategoryKey }
  | {
      type: "result";
      category: CategoryKey;
      matchId: string;
      winnerId: string;
      score: string;
    };
export interface Standing {
  team: Team;
  wins: number;
  points: number;
  place: number | null;
  stage: string;
  alive: boolean;
}
export const teamName = (t: Team) => `${t.player1} / ${t.player2}`;
export function emptyState(): TournamentState {
  return {
    women: { teams: [], started: false, results: {} },
    men: { teams: [], started: false, results: {} },
    version: 0,
  };
}
function name(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100)
    throw new Error("Vyplňte obě jména (nejvýše 100 znaků).");
  return value.trim();
}
export function roundName(round: number, total: number) {
  return ["Finále", "Semifinále", "Čtvrtfinále"][total - round - 1] ?? "Zápas";
}
export function getMatches(c: Category): Match[] {
  if (!c.started) return [];
  const size = 2 ** Math.ceil(Math.log2(c.teams.length));
  const seeds =
    size === 8 ? [1, 8, 4, 5, 2, 7, 3, 6] : size === 4 ? [1, 4, 2, 3] : [1, 2];
  let inputs: { id: string | null; ready: boolean }[] = seeds.map((s) => ({
    id: c.teams[s - 1]?.id ?? null,
    ready: true,
  }));
  const out: Match[] = [];
  for (let round = 0; inputs.length > 1; round++) {
    const next: typeof inputs = [];
    for (let i = 0; i < inputs.length; i += 2) {
      const a = inputs[i],
        b = inputs[i + 1],
        id = `${round}-${i / 2}`,
        ready = a.ready && b.ready,
        bye = ready && (!a.id || !b.id);
      const result = c.results[id];
      const valid =
        ready &&
        !bye &&
        result &&
        result.pair[0] === a.id &&
        result.pair[1] === b.id &&
        (result.winnerId === a.id || result.winnerId === b.id);
      const winnerId = bye ? a.id || b.id : valid ? result.winnerId : null;
      out.push({
        id,
        round,
        slot: i / 2,
        teamAId: a.id,
        teamBId: b.id,
        ready,
        bye,
        winnerId,
        score: valid ? result.score : "",
      });
      next.push({ id: winnerId, ready: bye || !!winnerId });
    }
    inputs = next;
  }
  return out;
}
export function applyAction(
  state: TournamentState,
  action: Action,
): TournamentState {
  if (!action || typeof action !== "object") throw new Error("Neplatná změna.");
  if (action.type === "reset") {
    if (!["demo", "empty"].includes(action.mode))
      throw new Error("Neplatný režim.");
    return {
      ...(action.mode === "demo" ? demoState() : emptyState()),
      version: state.version,
    };
  }
  if (!["women", "men"].includes(action.category))
    throw new Error("Neplatná kategorie.");
  const s = structuredClone(state),
    c = s[action.category];
  switch (action.type) {
    case "add": {
      if (c.started)
        throw new Error("Turnaj už začal. Můžete upravit jména dvojic.");
      if (c.teams.length >= 8)
        throw new Error("V kategorii může být nejvýše osm dvojic.");
      c.teams.push({
        id: crypto.randomUUID(),
        player1: name(action.player1),
        player2: name(action.player2),
      });
      break;
    }
    case "rename": {
      const t = c.teams.find((t) => t.id === action.teamId);
      if (!t) throw new Error("Dvojice nebyla nalezena.");
      t.player1 = name(action.player1);
      t.player2 = name(action.player2);
      break;
    }
    case "remove": {
      if (c.started) throw new Error("Po zahájení nelze dvojici odebrat.");
      if (!c.teams.some((t) => t.id === action.teamId))
        throw new Error("Dvojice nebyla nalezena.");
      c.teams = c.teams.filter((t) => t.id !== action.teamId);
      break;
    }
    case "start": {
      if (c.started) throw new Error("Turnaj už začal.");
      if (c.teams.length < 2)
        throw new Error("Zaregistrujte alespoň dvě dvojice.");
      c.started = true;
      break;
    }
    case "result": {
      const m = getMatches(c).find((m) => m.id === action.matchId);
      if (!m || !m.ready || m.bye || !m.teamAId || !m.teamBId)
        throw new Error("Tento zápas ještě nelze vyhodnotit.");
      if (action.winnerId !== m.teamAId && action.winnerId !== m.teamBId)
        throw new Error("Vyberte vítěze z účastníků zápasu.");
      if (
        typeof action.score !== "string" ||
        !action.score.trim() ||
        action.score.length > 100
      )
        throw new Error(
          "Doplňte skóre nebo důvod ukončení (nejvýše 100 znaků).",
        );
      c.results[m.id] = {
        winnerId: action.winnerId,
        score: action.score.trim(),
        pair: [m.teamAId, m.teamBId],
      };
      const validIds = new Set(
        getMatches(c)
          .filter((m) => m.winnerId && !m.bye)
          .map((m) => m.id),
      );
      for (const key of Object.keys(c.results))
        if (!validIds.has(key)) delete c.results[key];
      break;
    }
    default:
      throw new Error("Neznámá změna.");
  }
  return s;
}
export function standings(c: Category): Standing[] {
  const matches = getMatches(c),
    total = matches.length ? Math.max(...matches.map((m) => m.round)) + 1 : 0,
    final = matches.at(-1);
  const rows = c.teams.map((team) => {
    const wins = matches.filter((m) => !m.bye && m.winnerId === team.id).length;
    const loss = matches.find(
      (m) =>
        m.winnerId &&
        !m.bye &&
        (m.teamAId === team.id || m.teamBId === team.id) &&
        m.winnerId !== team.id,
    );
    const champion = !!final?.winnerId && final.winnerId === team.id;
    const place = champion
      ? 1
      : loss
        ? 2 ** (total - loss.round - 1) + 1
        : null;
    const next = matches.find(
      (m) => !m.winnerId && (m.teamAId === team.id || m.teamBId === team.id),
    );
    return {
      team,
      wins,
      points: 2 * wins,
      place,
      alive: !loss,
      stage: champion
        ? "Vítěz turnaje"
        : loss
          ? `${place}. místo`
          : next
            ? roundName(next.round, total)
            : c.started
              ? "Čeká na soupeře"
              : "Registrováno",
    };
  });
  return rows.sort((a, b) => {
    if (final?.winnerId) return (a.place ?? 99) - (b.place ?? 99);
    return b.points - a.points || Number(b.alive) - Number(a.alive);
  });
}
export function demoState(): TournamentState {
  let s = emptyState();
  const women = [
    ["Anna Nová", "Eva Malá"],
    ["Klára Veselá", "Petra Zelená"],
    ["Jana Dvořáková", "Lucie Bílá"],
    ["Tereza Černá", "Marie Svobodová"],
    ["Kateřina Jelínková", "Hana Krátká"],
    ["Barbora Pokorná", "Lenka Novotná"],
    ["Adéla Horáková", "Veronika Procházková"],
    ["Michaela Němcová", "Simona Marková"],
  ];
  const men = [
    ["Jan Nový", "Petr Malý"],
    ["Martin Veselý", "Tomáš Zelený"],
    ["Pavel Dvořák", "Lukáš Bílý"],
    ["David Černý", "Michal Svoboda"],
    ["Jakub Jelínek", "Ondřej Krátký"],
    ["Filip Pokorný", "Adam Novotný"],
    ["Matěj Horák", "Daniel Procházka"],
    ["Vojtěch Němec", "Šimon Marek"],
  ];
  for (const category of ["women", "men"] as const) {
    for (const [player1, player2] of category === "women" ? women : men)
      s = applyAction(s, { type: "add", category, player1, player2 });
    s = applyAction(s, { type: "start", category });
    const m = getMatches(s[category])[0];
    s = applyAction(s, {
      type: "result",
      category,
      matchId: m.id,
      winnerId: m.teamAId!,
      score: "6:3, 6:4",
    });
  }
  return s;
}
