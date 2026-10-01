"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Trophy,
  Users,
  GitBranch,
  Plus,
  ArrowUpRight,
  Check,
  RotateCcw,
  X,
  ChevronRight,
  RefreshCw,
  Pencil,
  Flag,
  Medal,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import {
  applyAction,
  getMatches,
  standings,
  roundName,
  type TournamentState,
  type CategoryKey,
  type Team,
  type Match,
  type Action,
} from "@/lib/tennis/tournament";
type Modal =
  | { kind: "team"; team?: Team }
  | { kind: "result"; match: Match }
  | { kind: "reset"; mode: "demo" | "empty" }
  | { kind: "start" };
export default function Home() {
  const [state, setState] = useState<TournamentState | null>(null),
    [category, setCategory] = useState<CategoryKey>("women"),
    [view, setView] = useState("bracket"),
    [modal, setModal] = useState<Modal | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [notice, setNotice] = useState("");
  const [p1, setP1] = useState(""),
    [p2, setP2] = useState(""),
    [score, setScore] = useState(""),
    [winner, setWinner] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  async function load() {
    try {
      const r = await fetch("/api/tournament", { cache: "no-store" });
      const data = (await r.json()) as TournamentState & { error?: string };
      if (!r.ok) throw new Error(data.error);
      setState(data);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Turnaj se nepodařilo načíst.");
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => {
    let active = true;
    fetch("/api/tournament", { cache: "no-store" })
      .then(async (r) => {
        const data = (await r.json()) as TournamentState & { error?: string };
        if (!r.ok) throw new Error(data.error);
        if (active) setState(data);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "Turnaj se nepodařilo načíst.",
          );
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (modal) {
      dialog.current?.showModal();
    } else dialog.current?.close();
  }, [modal]);
  function open(m: Modal) {
    setError("");
    setModal(m);
    if (m.kind === "team") {
      setP1(m.team?.player1 ?? "");
      setP2(m.team?.player2 ?? "");
    }
    if (m.kind === "result") {
      setScore(m.match.score);
      setWinner(m.match.winnerId ?? "");
    }
  }
  async function save(action: Action) {
    if (!state || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/tournament", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: state.version, action }),
      });
      const data = (await r.json()) as TournamentState & { error?: string };
      if (!r.ok) throw new Error(data.error);
      setState(data);
      setModal(null);
      setNotice("Změny jsou uložené.");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Uložení se nezdařilo. Zkuste to znovu.",
      );
    } finally {
      setBusy(false);
    }
  }
  const c = state?.[category],
    matches = c ? getMatches(c) : [],
    rows = c ? standings(c) : [],
    rounds = matches.length ? Math.max(...matches.map((m) => m.round)) + 1 : 0;
  const completed = matches.filter((m) => m.winnerId && !m.bye).length,
    total = c?.started ? c.teams.length - 1 : 0,
    champion = matches.at(-1)?.winnerId;
  const team = (id: string | null) => c?.teams.find((t) => t.id === id);
  const teamLabel = (id: string | null) => {
    const t = team(id);
    return t ? `${t.player1} / ${t.player2}` : "Čeká na soupeře";
  };
  function resultButton(m: Match) {
    return (
      <button
        className={`match-card ${m.winnerId ? "is-finished" : ""}`}
        key={m.id}
        disabled={busy || !m.ready || m.bye}
        onClick={() => open({ kind: "result", match: m })}
        aria-label={`${m.winnerId ? "Upravit výsledek" : "Zadat výsledek"}: ${teamLabel(m.teamAId)} proti ${teamLabel(m.teamBId)}`}
      >
        <div className="match-meta">
          <span>
            {roundName(m.round, rounds)} {m.slot + 1}
          </span>
          <span>
            {m.bye ? (
              "Volný postup"
            ) : m.winnerId ? (
              <>
                <Check size={12} /> Dohráno
              </>
            ) : m.ready ? (
              "Připraveno"
            ) : (
              "Čeká se"
            )}
          </span>
        </div>
        {[m.teamAId, m.teamBId].map((id, i) => {
          const t = team(id);
          return (
            <div
              className={`match-team ${id && m.winnerId === id ? "winner" : ""}`}
              key={i}
            >
              <span className="seed">
                {id ? c!.teams.findIndex((t) => t.id === id) + 1 : "–"}
              </span>
              <span className="names">
                {t ? (
                  <>
                    <strong>{t.player1}</strong>
                    <strong>{t.player2}</strong>
                  </>
                ) : (
                  <span>
                    {m.bye ? "Volné místo" : "Vítěz předchozího zápasu"}
                  </span>
                )}
              </span>
              {id && m.winnerId === id && <CheckCircle2 size={17} />}
            </div>
          );
        })}
        <div className="match-bottom">
          {m.score ? (
            <span>{m.score}</span>
          ) : (
            <span>
              {m.bye
                ? "Postup bez bodů"
                : m.ready
                  ? "Zapsat výsledek"
                  : "Čeká na výsledky"}
            </span>
          )}
          {m.ready && !m.bye && <Pencil size={13} />}
        </div>
      </button>
    );
  }
  let cleared = 0;
  if (state && modal?.kind === "result" && winner && score.trim()) {
    try {
      const next = applyAction(state, {
        type: "result",
        category,
        matchId: modal.match.id,
        winnerId: winner,
        score,
      });
      cleared = Object.keys(c!.results).filter(
        (id) => !next[category].results[id],
      ).length;
    } catch {}
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!modal) return;
    if (modal.kind === "team")
      void save(
        modal.team
          ? {
              type: "rename",
              category,
              teamId: modal.team.id,
              player1: p1,
              player2: p2,
            }
          : { type: "add", category, player1: p1, player2: p2 },
      );
    if (modal.kind === "result")
      void save({
        type: "result",
        category,
        matchId: modal.match.id,
        winnerId: winner,
        score,
      });
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="#" className="brand" aria-label="Tenis Cheb úvod">
          <span className="brand-mark">
            TK<span>•</span>
          </span>
          <span>
            TENIS<span>CHEB</span>
          </span>
        </a>
        <div className="side-label">TURNAJOVÉ CENTRUM</div>
        <nav aria-label="Hlavní navigace">
          <button className="nav-active" onClick={() => setView("bracket")}>
            <GitBranch size={19} /> Čtyřhra <ChevronRight size={15} />
          </button>
        </nav>
        <div className="side-note">
          <Trophy size={29} />
          <h3>Každý zápas se počítá.</h3>
          <p>
            Dvě dvojice. Jeden kurt.
            <br />
            Jeden krok blíž k poháru.
          </p>
        </div>
        <div className="side-footer">
          <span className="demo-dot" /> Demo turnaje
          <p>
            Prostor pro vyzkoušení.
            <br />
            Všechna jména jsou fiktivní.
          </p>
          <a
            href="https://www.tenisklubcheb.cz/"
            target="_blank"
            rel="noreferrer"
          >
            Web Tenisklubu Cheb <ArrowUpRight size={13} />
          </a>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Klubový tenis <ChevronRight size={13} /> Turnaje{" "}
            <ChevronRight size={13} /> <strong>Čtyřhra</strong>
          </span>
          <div className="demo-pill">DEMO</div>
        </header>
        <section className="page-heading">
          <div>
            <div className="eyebrow">TENIS CHEB / TURNAJ ČTYŘHER</div>
            <h1>
              Spolu na kurt.
              <br className="mobile-break" /> Spolu pro výhru.
            </h1>
            <p>
              Zaregistrujte dvojice, zapište výsledek a sledujte cestu do
              finále.
            </p>
          </div>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => open({ kind: "reset", mode: "demo" })}
          >
            <RotateCcw size={16} /> Obnovit demo
          </button>
        </section>
        <div className="category-tabs" role="tablist" aria-label="Kategorie">
          <button
            role="tab"
            aria-selected={category === "women"}
            className={category === "women" ? "selected" : ""}
            onClick={() => {
              setCategory("women");
              setError("");
            }}
          >
            <span>Ženská čtyřhra</span>
            <small>{state?.women.teams.length ?? 0} dvojic</small>
          </button>
          <button
            role="tab"
            aria-selected={category === "men"}
            className={category === "men" ? "selected" : ""}
            onClick={() => {
              setCategory("men");
              setError("");
            }}
          >
            <span>Mužská čtyřhra</span>
            <small>{state?.men.teams.length ?? 0} dvojic</small>
          </button>
        </div>
        {error && !modal && (
          <div className="error" role="alert">
            {error}
            <button onClick={() => void load()}>Načíst znovu</button>
          </div>
        )}
        {!state ? (
          <div className="loading">
            {loaded ? "Turnaj není momentálně dostupný." : "Načítání turnaje…"}
          </div>
        ) : (
          <>
            <section className="stats" aria-label="Přehled turnaje">
              <div>
                <span className="stat-icon">
                  <Users size={22} />
                </span>
                <div>
                  <small>Registrované dvojice</small>
                  <strong>
                    {c!.teams.length}
                    <em> / 8</em>
                  </strong>
                </div>
              </div>
              <div>
                <span className="stat-icon">
                  <Flag size={22} />
                </span>
                <div>
                  <small>Odehrané zápasy</small>
                  <strong>
                    {completed}
                    <em> / {total}</em>
                  </strong>
                </div>
              </div>
              <div>
                <span className="stat-icon lime">
                  <Trophy size={22} />
                </span>
                <div>
                  <small>Bodování turnaje</small>
                  <strong>
                    2 <em>body za výhru</em>
                  </strong>
                </div>
              </div>
            </section>
            <div className="workspace-head">
              <nav className="view-tabs" aria-label="Zobrazení turnaje">
                <button
                  className={view === "bracket" ? "active" : ""}
                  onClick={() => setView("bracket")}
                >
                  <GitBranch size={17} /> Pavouk
                </button>
                <button
                  className={view === "teams" ? "active" : ""}
                  onClick={() => setView("teams")}
                >
                  <Users size={17} /> Dvojice
                </button>
                <button
                  className={view === "standings" ? "active" : ""}
                  onClick={() => setView("standings")}
                >
                  <Medal size={17} /> Pořadí
                </button>
              </nav>
              <div className="save-status">
                <Check size={13} />
                <span>{busy ? "Ukládání…" : "Uloženo"} </span>
                <button
                  aria-label="Načíst aktuální stav"
                  title="Načíst aktuální stav"
                  disabled={busy}
                  onClick={() => void load()}
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
            {view === "bracket" &&
              (c!.started ? (
                <section className="bracket-section">
                  <div className="section-top">
                    <div>
                      <h2>Cesta do finále</h2>
                      <p>Klepnutím na zápas zadáte nebo upravíte výsledek.</p>
                    </div>
                    <span className="format-label">VYŘAZOVACÍ SYSTÉM</span>
                  </div>
                  <div
                    className="bracket"
                    style={{ "--rounds": rounds } as React.CSSProperties}
                  >
                    {Array.from({ length: rounds }, (_, r) => (
                      <div className="round" key={r}>
                        <h3>
                          <span>0{r + 1}</span> {roundName(r, rounds)}
                        </h3>
                        <div className="round-matches">
                          {matches
                            .filter((m) => m.round === r)
                            .map(resultButton)}
                        </div>
                      </div>
                    ))}
                    <div className="champion">
                      <div className="cup">
                        <Trophy size={34} />
                      </div>
                      <small>VÍTĚZNÁ DVOJICE</small>
                      {champion ? (
                        <>
                          <h3>
                            {team(champion)?.player1}
                            <br />
                            {team(champion)?.player2}
                          </h3>
                          <span className="champion-points">
                            {rows.find((r) => r.team.id === champion)?.points}{" "}
                            bodů
                          </span>
                        </>
                      ) : (
                        <>
                          <h3>
                            Tady začíná
                            <br />
                            váš příběh.
                          </h3>
                          <p>
                            Pohár čeká
                            <br />
                            na své vítěze.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="bracket-legend">
                    <span>
                      <i /> Vítěz zápasu postupuje
                    </span>
                    <span>Výhra 2 body · Prohra 0 bodů</span>
                  </div>
                </section>
              ) : (
                <section className="empty-state">
                  <GitBranch size={42} />
                  <h2>Nejprve představte své dvojice</h2>
                  <p>Přidejte 2 až 8 dvojic. Potom můžete rozehrát turnaj.</p>
                  <button className="primary" onClick={() => setView("teams")}>
                    Přejít na registraci <Users size={16} />
                  </button>
                </section>
              ))}
            {view === "teams" && (
              <section className="panel">
                <div className="section-top">
                  <div>
                    <h2>
                      {c!.started ? "Dvojice na turnaji" : "Registrace dvojic"}
                    </h2>
                    <p>
                      {c!.started
                        ? "Jména můžete upravit kdykoli. Výsledky zůstanou zachované."
                        : "Pořadí registrace určí nasazení do pavouka."}
                    </p>
                  </div>
                  {!c!.started && (
                    <button
                      className="primary"
                      disabled={busy || c!.teams.length >= 8}
                      onClick={() => open({ kind: "team" })}
                    >
                      <Plus size={16} /> Přidat dvojici
                    </button>
                  )}
                </div>
                <div className="team-grid">
                  {c!.teams.map((t, i) => (
                    <article className="team-card" key={t.id}>
                      <span className="team-number">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <strong>{t.player1}</strong>
                        <strong>{t.player2}</strong>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={`Upravit dvojici ${i + 1}`}
                        disabled={busy}
                        onClick={() => open({ kind: "team", team: t })}
                      >
                        <Pencil size={16} />
                      </button>
                      {!c!.started && (
                        <button
                          className="icon-button"
                          aria-label={`Odebrat dvojici ${i + 1}`}
                          disabled={busy}
                          onClick={() =>
                            void save({
                              type: "remove",
                              category,
                              teamId: t.id,
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </article>
                  ))}
                </div>
                {!c!.teams.length && (
                  <p className="empty-hint">
                    Zatím žádná dvojice. Přidejte oba hráče pomocí tlačítka
                    nahoře.
                  </p>
                )}
                {!c!.started && (
                  <div className="registration-footer">
                    <span>{c!.teams.length}/8 dvojic · minimálně 2</span>
                    <button
                      className="primary"
                      disabled={busy || c!.teams.length < 2}
                      onClick={() => open({ kind: "start" })}
                    >
                      Vytvořit pavouka <GitBranch size={16} />
                    </button>
                  </div>
                )}
              </section>
            )}
            {(view === "standings" || (view === "bracket" && c!.started)) && (
              <section className="panel standings">
                <div className="section-top">
                  <div>
                    <h2>Průběžné pořadí</h2>
                    <p>
                      Body za odehrané zápasy. Konečné umístění určuje dosažené
                      kolo.
                    </p>
                  </div>
                  <Medal size={23} />
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Pořadí</th>
                        <th>Dvojice</th>
                        <th>Výhry</th>
                        <th>Body</th>
                        <th>Stav</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.team.id}>
                          <td>
                            <span
                              className={
                                r.place === 1 ? "place first" : "place"
                              }
                            >
                              {r.place ?? "–"}
                            </span>
                          </td>
                          <td>
                            <strong>{r.team.player1}</strong>
                            <span className="table-slash"> / </span>
                            <strong>{r.team.player2}</strong>
                          </td>
                          <td>{r.wins}</td>
                          <td>
                            <b className="points">{r.points}</b>
                          </td>
                          <td>
                            <span className={`stage ${r.alive ? "alive" : ""}`}>
                              {r.stage}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!rows.length && (
                  <p className="empty-hint">
                    Po registraci se zde objeví dvojice a jejich body.
                  </p>
                )}
              </section>
            )}
            <footer className="page-footer">
              <span>DEMO · Fiktivní data · Soukromý zkušební turnaj</span>
              <button
                disabled={busy}
                onClick={() => open({ kind: "reset", mode: "empty" })}
              >
                Začít prázdnou registrací
              </button>
            </footer>
            <span className="sr-only" role="status">
              {notice}
            </span>
          </>
        )}
      </main>
      <dialog
        ref={dialog}
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setModal(null);
        }}
        onClick={(e) => {
          if (e.target === dialog.current && !busy) setModal(null);
        }}
      >
        <div className="dialog-content">
          <button
            className="close-dialog"
            aria-label="Zavřít"
            disabled={busy}
            onClick={() => setModal(null)}
          >
            <X size={20} />
          </button>
          {modal?.kind === "team" && (
            <>
              <div className="eyebrow">
                {category === "women" ? "ŽENSKÁ" : "MUŽSKÁ"} ČTYŘHRA
              </div>
              <h2>{modal.team ? "Upravit dvojici" : "Nová dvojice"}</h2>
              <p>Každý tým tvoří dva hráči. Obě jména jsou povinná.</p>
              <form onSubmit={submit}>
                <label>
                  Jméno prvního hráče
                  <input
                    autoFocus
                    required
                    maxLength={100}
                    value={p1}
                    onChange={(e) => setP1(e.target.value)}
                    placeholder="Jméno a příjmení"
                  />
                </label>
                <label>
                  Jméno druhého hráče
                  <input
                    required
                    maxLength={100}
                    value={p2}
                    onChange={(e) => setP2(e.target.value)}
                    placeholder="Jméno a příjmení"
                  />
                </label>
                {error && (
                  <div className="error" role="alert">
                    {error}
                    <button type="button" onClick={() => void load()}>
                      Načíst aktuální stav
                    </button>
                  </div>
                )}
                <button className="primary full" disabled={busy}>
                  {busy
                    ? "Ukládání…"
                    : modal.team
                      ? "Uložit jména"
                      : "Zaregistrovat dvojici"}
                </button>
              </form>
            </>
          )}
          {modal?.kind === "result" && (
            <>
              <div className="eyebrow">
                {roundName(modal.match.round, rounds)}
              </div>
              <h2>
                {modal.match.winnerId ? "Upravit výsledek" : "Výsledek zápasu"}
              </h2>
              <form onSubmit={submit}>
                <fieldset>
                  <legend>Vyberte vítěznou dvojici</legend>
                  {[modal.match.teamAId, modal.match.teamBId].map((id) => (
                    <label
                      className={`winner-option ${winner === id ? "chosen" : ""}`}
                      key={id}
                    >
                      <input
                        type="radio"
                        name="winner"
                        required
                        checked={winner === id}
                        value={id ?? ""}
                        onChange={() => setWinner(id!)}
                      />
                      <span>
                        {team(id)?.player1}
                        <br />
                        {team(id)?.player2}
                      </span>
                      <Trophy size={19} />
                    </label>
                  ))}
                </fieldset>
                <label>
                  Skóre zápasu
                  <input
                    required
                    maxLength={100}
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    placeholder="Např. 6:3, 6:4 nebo skreč"
                  />
                </label>
                <p className="field-help">
                  Skóre zapisujte z pohledu vítěze. Vítěz získá 2 body.
                </p>
                {cleared > 0 && (
                  <div className="warning">
                    Změna vítěze smaže {cleared} navazující{" "}
                    {cleared === 1 ? "výsledek" : "výsledky"}. Uložením tuto
                    opravu potvrdíte.
                  </div>
                )}
                {error && (
                  <div className="error" role="alert">
                    {error}
                    <button type="button" onClick={() => void load()}>
                      Načíst aktuální stav
                    </button>
                  </div>
                )}
                <button className="primary full" disabled={busy || !winner}>
                  {busy ? "Ukládání…" : "Uložit výsledek"}
                </button>
              </form>
            </>
          )}
          {modal?.kind === "start" && (
            <>
              <GitBranch size={30} />
              <h2>Rozehrát turnaj?</h2>
              <p>
                Z {c?.teams.length} dvojic vytvoříme pavouka. Po zahájení půjde
                upravovat jména a výsledky, přidávání či odebírání dvojic se
                uzavře.
              </p>
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <button
                className="primary full"
                disabled={busy}
                onClick={() => {
                  setView("bracket");
                  void save({ type: "start", category });
                }}
              >
                Vytvořit pavouka
              </button>
            </>
          )}
          {modal?.kind === "reset" && (
            <>
              <RotateCcw size={30} />
              <h2>
                {modal.mode === "demo"
                  ? "Obnovit ukázkový turnaj?"
                  : "Začít od začátku?"}
              </h2>
              <p>
                {modal.mode === "demo"
                  ? "Obě kategorie nahradíme osmi fiktivními dvojicemi a jedním ukázkovým výsledkem."
                  : "Vymažeme dvojice i výsledky v obou kategoriích. Potom můžete vyzkoušet vlastní registraci."}{" "}
                Dosavadní změny v demu se odstraní.
              </p>
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <div className="dialog-actions">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => setModal(null)}
                >
                  Zrušit
                </button>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => {
                    setView(modal.mode === "empty" ? "teams" : "bracket");
                    void save({ type: "reset", mode: modal.mode });
                  }}
                >
                  {busy ? "Ukládání…" : "Potvrdit"}
                </button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
