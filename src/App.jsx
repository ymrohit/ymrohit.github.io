import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  MailIcon,
  MarkGithubIcon,
  PaperAirplaneIcon,
  PlusIcon,
  XIcon,
} from "@primer/octicons-react";

import { byId, evidence, profile, selectedWork, suggestedPrompts } from "./data";

const runtimeSteps = [
  { id: "understanding", label: "Understand" },
  { id: "reading", label: "Retrieve" },
  { id: "reasoning", label: "Connect" },
  { id: "verifying", label: "Verify" },
];

const achievementBadges = [
  { src: "./assets/achievement-pair.png", label: "GitHub Pair Extraordinaire" },
  { src: "./assets/achievement-quickdraw.png", label: "GitHub Quickdraw" },
  { src: "./assets/achievement-starstruck.png", label: "GitHub Starstruck" },
  { src: "./assets/achievement-yolo.png", label: "GitHub YOLO" },
];

function InlineReceipt({ item, onClose }) {
  return (
    <div className="inline-receipt" aria-live="polite">
      <button className="receipt-close" type="button" onClick={onClose} aria-label={`Close ${item.title}`}>
        <XIcon size={18} />
      </button>
      <p>{item.detail}</p>
      <div className="receipt-proof">
        <strong>{item.metric}</strong>
        <span>{item.secondaryMetric}</span>
        {item.sourceUrl ? (
          <a href={item.sourceUrl} target="_blank" rel="noreferrer">
            {item.linkLabel} <ArrowUpRightIcon size={14} />
          </a>
        ) : (
          <span className="local-proof">running on this page</span>
        )}
      </div>
    </div>
  );
}

function ProjectRow({ item, active, onOpen }) {
  return (
    <article className={`work-item ${active ? "is-open" : ""}`} data-evidence-id={item.id}>
      <button
        className="work-row"
        type="button"
        onClick={() => onOpen(item.id)}
        aria-expanded={active}
        aria-label={`Explore ${item.title}`}
        tabIndex={active ? -1 : 0}
      >
        <span className="work-topline">
          <small>{item.eyebrow}</small>
          <span>{item.metric}</span>
        </span>
        <strong>{item.title}</strong>
        <span className="work-summary">{item.summary}</span>
        <span className="work-action">
          Explore <PlusIcon size={16} />
        </span>
      </button>
      <div className="work-expansion" aria-hidden={!active}>
        {active && <InlineReceipt item={item} onClose={() => onOpen(item.id)} />}
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
          {source.title.replace(/[—–]/g, "-")} <ArrowUpRightIcon size={12} />
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
  const [modelLabel, setModelLabel] = useState("10.95 MB");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [activity, setActivity] = useState(null);
  const [commandResult, setCommandResult] = useState(null);
  const [conversation, setConversation] = useState([]);
  const workerRef = useRef(null);
  const pendingRef = useRef(new Map());
  const requestIdRef = useRef(0);
  const activityQueueRef = useRef(Promise.resolve());
  const inputRef = useRef(null);

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
    setRouterStatus(`loading ${modelLabel} locally`);
    const worker = new Worker(new URL("./profile-worker.js", window.location.href), { type: "module" });
    workerRef.current = worker;
    worker.addEventListener("message", (event) => {
      const message = event.data || {};
      if (message.type === "progress") {
        if (message.stage === "loading") setRouterStatus(message.text || "loading local AI");
        if (message.id) {
          activityQueueRef.current = activityQueueRef.current.then(() => new Promise((resolve) => {
            setActivity({ stage: message.stage, text: message.text });
            window.setTimeout(resolve, 180);
          }));
        }
      } else if (message.type === "ready") {
        if (message.bundleBytes) setModelLabel(`${(message.bundleBytes / 1_000_000).toFixed(2)} MB`);
        setRouterState("ready");
        setRouterStatus(`online, ${message.records} public records`);
      } else if (message.type === "answered") {
        const pending = pendingRef.current.get(message.id);
        if (pending) {
          activityQueueRef.current.then(() => {
            pendingRef.current.delete(message.id);
            pending.resolve(message);
          });
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

  function choosePrompt(prompt) {
    setQuery(prompt);
    activateRouter();
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function askProfile(text, history, priorIds) {
    return new Promise((resolve, reject) => {
      const id = ++requestIdRef.current;
      activityQueueRef.current = Promise.resolve();
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
      setRouterStatus(`online, ${decision.corpusSize} public records`);
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
  const stageByActivity = { understanding: 0, reading: 1, reasoning: 2, writing: 3, verifying: 3 };
  const stageIndex = activity
    ? (stageByActivity[activity.stage] ?? 0)
    : commandResult?.verified ? runtimeSteps.length : -1;

  return (
    <div className="site-shell">
      <a className="skip-link" href="#content">Skip to content</a>

      <header className="site-header">
        <a className="wordmark" href="#content" aria-label="Rohit Yelukati Mahendra, home">
          <span>Rohit Yelukati Mahendra</span>
          <small>Applied AI Engineer</small>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#proof">Proof</a>
          <a href="#reasoner">Ask</a>
          <a href="#work">Work</a>
        </nav>
        <a className="header-link" href={profile.githubUrl} target="_blank" rel="noreferrer">
          <MarkGithubIcon size={18} /> GitHub <ArrowUpRightIcon size={13} />
        </a>
      </header>

      <main id="content">
        <section className="hero" data-reveal>
          <div className="hero-copy">
            <p className="eyebrow">Applied AI, built in public</p>
            <h1>I build AI systems <span>that earn trust.</span></h1>
            <p className="hero-intro">{profile.summary}</p>
            <div className="hero-actions">
              <a className="primary-link" href="#reasoner">
                Ask the profile <ArrowDownIcon size={16} />
              </a>
              <a href="#proof">See the proof <ArrowRightIcon size={15} /></a>
            </div>
          </div>

          <aside className="identity-note" aria-label="About Rohit">
            <div className="portrait-stage">
              <span className="portrait-orbit" aria-hidden="true" />
              <img className="portrait" src="./assets/rohit-avatar.png" alt="Rohit Yelukati Mahendra" />
              <div className="badge-orbit" aria-label="GitHub achievements">
                {achievementBadges.map((badge) => (
                  <img
                    key={badge.label}
                    src={badge.src}
                    alt={badge.label}
                  />
                ))}
              </div>
              <a className="hero-proof" href={evidence[0].sourceUrl} target="_blank" rel="noreferrer">
                <strong>#1</strong>
                <span>PyTorch Docathon<br />worldwide</span>
                <ArrowUpRightIcon size={14} />
              </a>
            </div>
            <div className="identity-copy">
              <div>
                <strong>Rohit Yelukati Mahendra</strong>
                <span>United Kingdom</span>
              </div>
              <p>More than five years of applied AI, automation, and systems ownership in regulated operations.</p>
              <div className="identity-links">
                <a href={`mailto:${profile.email}`}>Email</a>
                <a href={profile.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn</a>
                <a href={profile.coffeeUrl} target="_blank" rel="noreferrer">Coffee</a>
              </div>
            </div>
          </aside>
        </section>

        <section className="achievement-band" id="proof" data-reveal>
          <a className="achievement-main" href={evidence[0].sourceUrl} target="_blank" rel="noreferrer">
            <div className="achievement-rank">
              <span>#1</span>
              <small>worldwide</small>
            </div>
            <div className="achievement-copy">
              <small>Official global leaderboard</small>
              <h2>PyTorch Docathon 2026</h2>
              <p>Documentation work that landed upstream across PyTorch, ExecuTorch, and Tutorials.</p>
            </div>
            <dl>
              <div><dt>47</dt><dd>points</dd></div>
              <div><dt>19</dt><dd>merged PRs</dd></div>
            </dl>
            <ArrowUpRightIcon className="achievement-arrow" size={20} />
          </a>
          <div className="proof-facts" aria-label="Public profile facts">
            <div><strong>5+</strong><span>years at Xeal Pharma</span></div>
            <div><strong>25</strong><span>public repositories</span></div>
            <div><strong>3</strong><span>published PyPI packages</span></div>
            <div><strong>93</strong><span>profile evidence records</span></div>
          </div>
        </section>

        <section className="reasoner-section" id="reasoner" data-reveal>
          <div className="section-intro">
            <h2>Ask the work.<span>Get the receipts.</span></h2>
            <p>The model runs here, reads the public record, and cites the evidence behind every supported answer.</p>
          </div>

          <div className="local-router">
            <div className="router-meta">
              <div>
                <span className={`router-state ${routerState}`}><i /> {routerStatus}</span>
                <p className="runtime-disclosure">
                  <strong>{modelLabel} neural planner</strong>
                  <span>runs entirely in this tab</span>
                  <span>no server</span>
                </p>
              </div>
              {routerState !== "ready" && (
                <button type="button" onClick={activateRouter} disabled={routerState === "loading"}>
                  {routerState === "loading" ? "loading" : "load local AI"}
                </button>
              )}
            </div>

            <div className="reasoner-path" aria-label="Live reasoning path">
              {runtimeSteps.map((step, index) => {
                const state = index < stageIndex ? "done" : index === stageIndex ? "active" : "idle";
                return (
                  <span key={step.id} data-state={state}>
                    <i /> {step.label}
                  </span>
                );
              })}
            </div>

            <div className="prompt-starters" aria-label="Suggested questions">
              {suggestedPrompts.map((prompt) => (
                <button key={prompt} type="button" onClick={() => choosePrompt(prompt)}>{prompt}</button>
              ))}
            </div>

            <form className="command-line" onSubmit={(event) => { event.preventDefault(); submitPrompt(); }}>
              <label htmlFor="profile-prompt">Ask anything about Rohit’s public profile</label>
              <div>
                <input
                  ref={inputRef}
                  id="profile-prompt"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onFocus={activateRouter}
                  placeholder="Who is Rohit, and what is he strongest at?"
                  autoComplete="off"
                />
                <button type="submit" aria-label="Ask the local profile" disabled={commandBusy || !query.trim()}>
                  <PaperAirplaneIcon size={21} />
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
                    verified here, {commandResult.evidenceRead} records read, {commandResult.latencyMs} ms
                  </small>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="work-section" id="work" data-reveal>
          <div className="section-intro">
            <h2>Systems, not demos.</h2>
            <p>Five public builds where models meet execution, verification, privacy, and real constraints.</p>
          </div>

          <div className="work-list">
            {workItems.map((item) => (
              <ProjectRow
                key={item.id}
                item={item}
                active={item.id === activeId}
                onOpen={(id) => setActiveId((current) => current === id ? null : id)}
              />
            ))}
          </div>
        </section>

        <section className="thesis-section" data-reveal>
          <blockquote>Models can propose.<span>Systems must decide.</span></blockquote>
          <div>
            <p>That principle connects the verifiers, local inference, typed contracts, and open-source work across this portfolio.</p>
            <a className="contact-link" href={`mailto:${profile.email}`}>
              <MailIcon size={18} /> Email Rohit <ArrowRightIcon size={16} />
            </a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div><strong>Rohit Yelukati Mahendra</strong><span>Applied AI Engineer</span></div>
        <p>Private by construction. No analytics, cookies, or prompt transmission.</p>
        <a href="https://github.com/ymrohit/ymrohit.github.io" target="_blank" rel="noreferrer">
          Source <ArrowUpRightIcon size={13} />
        </a>
      </footer>
    </div>
  );
}
