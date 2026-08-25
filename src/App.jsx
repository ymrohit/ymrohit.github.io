import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpRightIcon,
  MarkGithubIcon,
  PaperAirplaneIcon,
} from "@primer/octicons-react";

import { byId, evidence, profile, selectedWork } from "./data";

function InlineReceipt({ item }) {
  return (
    <div className="inline-receipt" aria-live="polite">
      <p>{item.detail}</p>
      <div className="receipt-proof">
        <strong>{item.metric}</strong>
        <span>{item.secondaryMetric}</span>
        {item.sourceUrl ? (
          <a href={item.sourceUrl} target="_blank" rel="noreferrer">
            {item.linkLabel} <ArrowUpRightIcon size={13} />
          </a>
        ) : (
          <span className="local-proof">running on this page</span>
        )}
      </div>
    </div>
  );
}

function ProjectRow({ item, index, active, onOpen }) {
  return (
    <article className={`work-item ${active ? "is-open" : ""}`} data-evidence-id={item.id}>
      <button
        className="work-row"
        type="button"
        onClick={() => onOpen(item.id)}
        aria-expanded={active}
      >
        <span className="work-index">{String(index + 1).padStart(2, "0")}</span>
        <span className="work-copy">
          <small>{item.eyebrow}</small>
          <strong>{item.title}</strong>
          <span>{item.summary}</span>
        </span>
        <span className="work-metric">{item.metric}</span>
        <span className="work-toggle" aria-hidden="true">{active ? "−" : "+"}</span>
      </button>
      <div className="work-expansion">
        <div>{active && <InlineReceipt item={item} />}</div>
      </div>
    </article>
  );
}

function SourceReceipts({ sources }) {
  if (!sources?.length) return null;
  return (
    <div className="answer-sources" aria-label="Public sources">
      <span>Evidence</span>
      {sources.map((source) => source.url ? (
        <a href={source.url} target="_blank" rel="noreferrer" key={source.id}>
          {source.title.replace(/[—–]/g, "-")} <ArrowUpRightIcon size={11} />
        </a>
      ) : (
        <span className="source-label" key={source.id}>{source.title.replace(/[—–]/g, "-")}</span>
      ))}
    </div>
  );
}

export function App() {
  const [routerState, setRouterState] = useState("idle");
  const [routerStatus, setRouterStatus] = useState("ready when you are");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [activity, setActivity] = useState(null);
  const [commandResult, setCommandResult] = useState(null);
  const [conversation, setConversation] = useState([]);
  const workerRef = useRef(null);
  const pendingRef = useRef(new Map());
  const requestIdRef = useRef(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.12 },
    );
    document.querySelectorAll("[data-reveal]").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const workItems = useMemo(
    () => [...selectedWork, "openscenesense-ollama"].map(byId).filter(Boolean),
    [],
  );

  function activateRouter() {
    if (routerState === "loading" || routerState === "ready") return;
    setRouterState("loading");
    setRouterStatus("loading 9.73 MB locally");
    const worker = new Worker(new URL("./profile-worker.js", window.location.href), { type: "module" });
    workerRef.current = worker;
    worker.addEventListener("message", (event) => {
      const message = event.data || {};
      if (message.type === "progress") {
        if (message.stage === "loading") setRouterStatus(message.text || "loading local AI");
        if (message.id) setActivity({ stage: message.stage, text: message.text });
      } else if (message.type === "ready") {
        setRouterState("ready");
        setRouterStatus(`online · ${message.records} public records`);
      } else if (message.type === "answered") {
        const pending = pendingRef.current.get(message.id);
        if (pending) {
          pendingRef.current.delete(message.id);
          pending.resolve(message);
        }
      } else if (message.type === "error") {
        const pending = pendingRef.current.get(message.id);
        if (pending) {
          pendingRef.current.delete(message.id);
          pending.reject(new Error(message.error));
        }
        setRouterState("error");
        setActivity(null);
        setRouterStatus("local runtime unavailable");
      }
    });
    worker.postMessage({ type: "load" });
  }

  function askProfile(text, history, priorIds) {
    return new Promise((resolve, reject) => {
      const id = ++requestIdRef.current;
      pendingRef.current.set(id, { resolve, reject });
      workerRef.current.postMessage({ type: "ask", id, question: text, history, priorIds });
    });
  }

  async function submitPrompt() {
    const prompt = query.trim();
    if (!prompt) return;
    if (routerState !== "ready") {
      setCommandResult({
        answer: "The local model is still loading. Your question stays in this browser.",
        sources: [],
      });
      activateRouter();
      return;
    }

    setCommandResult(null);
    setActivity({ stage: "understanding", text: "understanding the question" });
    const previousTurn = conversation.at(-1);
    const history = previousTurn
      ? `Earlier question: ${previousTurn.question.slice(0, 120)} Earlier answer: ${previousTurn.answer.slice(0, 260)}`
      : "";
    const priorIds = previousTurn?.sources?.map((source) => source.id) || [];
    try {
      const decision = await askProfile(prompt, history, priorIds);
      setCommandResult(decision);
      setConversation((current) => [...current, {
        question: prompt,
        answer: decision.answer,
        sources: decision.sources,
      }].slice(-3));
      setRouterStatus(`online · ${decision.corpusSize} public records`);
      setActivity(null);
    } catch {
      setRouterState("error");
      setRouterStatus("local runtime unavailable");
      setActivity(null);
      setCommandResult({
        answer: "The browser runtime stopped. No remote fallback was called, and the public evidence remains available below.",
        sources: [],
      });
    }
  }

  const commandBusy = Boolean(activity);

  return (
    <div className="site-shell">
      <a className="skip-link" href="#content">Skip to content</a>

      <header className="site-header">
        <a className="wordmark" href="#content" aria-label="Rohit Mahendra, home">
          <span>Rohit Mahendra</span>
          <small>AI systems engineer</small>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#proof">Proof</a>
          <a href="#reasoner">Ask</a>
          <a href="#work">Work</a>
        </nav>
        <a className="header-link" href={profile.githubUrl} target="_blank" rel="noreferrer">
          <MarkGithubIcon size={17} /> GitHub <ArrowUpRightIcon size={11} />
        </a>
      </header>

      <main id="content">
        <section className="hero" data-reveal>
          <div className="hero-copy">
            <p className="eyebrow">Python · AI systems · open source</p>
            <h1>I build AI systems <em>that prove their work.</em></h1>
            <p className="hero-intro">{profile.summary}</p>
            <div className="hero-actions">
              <a className="primary-link" href="#reasoner">Ask my work <ArrowDownIcon size={14} /></a>
              <a href="#work">Explore selected systems</a>
            </div>
          </div>

          <aside className="identity-note" aria-label="About Rohit">
            <img src="./assets/rohit-avatar.png" alt="Rohit Yelukati Mahendra" />
            <div>
              <strong>Rohit Yelukati Mahendra</strong>
              <span>United Kingdom</span>
            </div>
            <p>Building small, inspectable intelligence and the systems that hold it accountable.</p>
            <div className="identity-links">
              <a href={profile.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn</a>
              <a href={profile.coffeeUrl} target="_blank" rel="noreferrer">Coffee</a>
            </div>
          </aside>
        </section>

        <section className="achievement-band" id="proof" data-reveal>
          <a href={evidence[0].sourceUrl} target="_blank" rel="noreferrer">
            <div className="achievement-rank"><span>#1</span><small>worldwide</small></div>
            <div className="achievement-copy">
              <small>Official global leaderboard</small>
              <h2>PyTorch Docathon 2026</h2>
            </div>
            <dl>
              <div><dt>47</dt><dd>points</dd></div>
              <div><dt>19</dt><dd>merged PRs</dd></div>
            </dl>
            <ArrowUpRightIcon className="achievement-arrow" size={18} />
          </a>
        </section>

        <section className="reasoner-section" id="reasoner" data-reveal>
          <div className="section-intro">
            <p className="section-number">01 / Live profile</p>
            <div>
              <h2>Don’t browse my résumé.<br /><em>Question the work.</em></h2>
              <p>A distilled neural planner reads my full public record, connects evidence across projects, and answers with receipts.</p>
            </div>
          </div>

          <div className="local-router">
            <div className="router-meta">
              <span className={`router-state ${routerState}`}><i /> {routerStatus}</span>
              <p className="runtime-disclosure">
                <strong>9.73 MB neural planner</strong>
                <span>runs entirely in this tab</span>
                <span>no server</span>
              </p>
              {routerState !== "ready" && (
                <button type="button" onClick={activateRouter} disabled={routerState === "loading"}>
                  {routerState === "loading" ? "loading" : "load local AI"}
                </button>
              )}
            </div>

            <form className="command-line" onSubmit={(event) => { event.preventDefault(); submitPrompt(); }}>
              <label htmlFor="profile-prompt">Ask anything about Rohit’s public work</label>
              <div>
                <input
                  id="profile-prompt"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onFocus={activateRouter}
                  placeholder="What has he built around browser-local AI?"
                  autoComplete="off"
                />
                <button type="submit" aria-label="Ask the local profile" disabled={commandBusy || !query.trim()}>
                  <PaperAirplaneIcon size={19} />
                </button>
              </div>
            </form>

            {activity && (
              <div className="reasoner-activity" data-stage={activity.stage} aria-live="polite">
                <span className="activity-mark"><i /><i /><i /></span>
                <span>{activity.text}</span>
                <small>live in this tab</small>
              </div>
            )}

            {commandResult && (
              <div className="profile-answer" aria-live="polite">
                <p>{commandResult.answer}</p>
                <SourceReceipts sources={commandResult.sources} />
                {commandResult.verified && (
                  <small className="answer-proof">
                    verified here · {commandResult.evidenceRead} records read · {commandResult.latencyMs} ms
                  </small>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="work-section" id="work" data-reveal>
          <div className="section-intro">
            <p className="section-number">02 / Selected systems</p>
            <div>
              <h2>Ambitious ideas.<br /><em>Measured outputs.</em></h2>
              <p>Five public systems spanning verified code generation, GPU kernels, multimodal intelligence, and browser AI.</p>
            </div>
          </div>

          <div className="work-list">
            {workItems.map((item, index) => (
              <ProjectRow
                key={item.id}
                item={item}
                index={index}
                active={item.id === activeId}
                onOpen={(id) => setActiveId((current) => current === id ? null : id)}
              />
            ))}
          </div>
        </section>

        <section className="thesis-section" data-reveal>
          <p className="section-number">03 / Working thesis</p>
          <blockquote>Models can propose.<br /><em>Systems must decide.</em></blockquote>
          <p>That principle connects the verifiers, local inference, typed contracts, public receipts, and open-source work across this portfolio.</p>
        </section>
      </main>

      <footer className="site-footer">
        <div><strong>Rohit Mahendra</strong><span>AI systems that prove their work.</span></div>
        <p>Private by construction: no analytics, cookies, or prompt transmission.</p>
        <a href="https://github.com/ymrohit/ymrohit.github.io" target="_blank" rel="noreferrer">
          Source <ArrowUpRightIcon size={11} />
        </a>
      </footer>
    </div>
  );
}
