import { env } from "cloudflare:workers";
import {
  ConflictError,
  loadTournament,
  mutateTournament,
  type Store,
} from "@/lib/tennis/storage";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
function database() {
  if (!env.DB) throw new Error("Database unavailable");
  return env.DB as unknown as Store;
}
export async function GET() {
  try {
    return Response.json(await loadTournament(database()), { headers });
  } catch (e) {
    console.error("Tournament load failed", e);
    return Response.json(
      { error: "Turnaj se nepodařilo načíst. Zkuste to znovu." },
      { status: 503, headers },
    );
  }
}
export async function POST(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return Response.json(
      { error: "Nepovolený požadavek." },
      { status: 403, headers },
    );
  if (!request.headers.get("content-type")?.includes("application/json"))
    return Response.json({ error: "Očekáván JSON." }, { status: 415, headers });
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 8000) throw new Error();
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Neplatná data." }, { status: 400, headers });
  }
  try {
    return Response.json(
      await mutateTournament(database(), body?.version, body?.action),
      { headers },
    );
  } catch (e) {
    if (e instanceof ConflictError)
      return Response.json({ error: e.message }, { status: 409, headers });
    const message = e instanceof Error ? e.message : "";
    const validation = [
      "Neplatná",
      "Neplatný",
      "Vyplňte",
      "Vyberte",
      "Doplňte",
      "Turnaj už",
      "V kategorii",
      "Dvojice nebyla",
      "Po zahájení",
      "Zaregistrujte",
      "Tento zápas",
      "Neznámá",
    ];
    if (validation.some((p) => message.startsWith(p)))
      return Response.json({ error: message }, { status: 400, headers });
    console.error("Tournament save failed", e);
    return Response.json(
      {
        error:
          "Uložení se nezdařilo. Vaše zadání zůstalo ve formuláři; zkuste to znovu.",
      },
      { status: 503, headers },
    );
  }
}
