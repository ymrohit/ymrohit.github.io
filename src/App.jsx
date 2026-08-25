import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRightIcon,
  BookIcon,
  BriefcaseIcon,
  ClockIcon,
  CodeIcon,
  CpuIcon,
  LinkIcon,
  MarkGithubIcon,
  PaperAirplaneIcon,
  PlayIcon,
  ProjectIcon,
  RepoIcon,
  ShieldCheckIcon,
  SparklesFillIcon,
  StarIcon,
  TerminalIcon,
  TrophyIcon,
} from "@primer/octicons-react";

import { byId, evidence, pinnedIds, profile, selectedWork } from "./data";

const achievements = [
  { src: "achievement-yolo.png", name: "YOLO", detail: "merged without review" },
  { src: "achievement-starstruck.png", name: "Starstruck", detail: "public work earned stars" },
  { src: "achievement-pair.png", name: "Pair Extraordinaire", detail: "coauthored merged work" },
  { src: "achievement-quickdraw.png", name: "Quickdraw", detail: "fast issue resolution" },
];

const iconMap = {
  trophy: TrophyIcon,
  shield: ShieldCheckIcon,
  cpu: CpuIcon,
  sparkles: SparklesFillIcon,
  play: PlayIcon,
  terminal: TerminalIcon,
};

function EvidenceIcon({ name, size = 18 }) {
  const Icon = iconMap[name] || CodeIcon;
  return <Icon size={size} />;
}

function InlineReceipt({ item }) {
  return (
    <div className="inline-receipt" aria-live="polite">
      <div className="receipt-heading">
        <span><i /> PUBLIC PROJECT RECEIPT</span>
      </div>

      <p>{item.detail}</p>
      <div className="receipt-proof">
        <strong>{item.metric}</strong>
        <span>{item.secondaryMetric}</span>
        {item.sourceUrl ? (
          <a href={item.sourceUrl} target="_blank" rel="noreferrer">
            {item.linkLabel} <ArrowUpRightIcon size={13} />
          </a>
        ) : (
          <span className="local-proof">model served from this page</span>
        )}
      </div>
      <small className="receipt-note">Click again to close.</small>
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
      >
        <span className="work-icon"><EvidenceIcon name={item.icon} /></span>
        <span className="work-copy">
          <strong>{item.title}</strong>
          <small>{item.summary}</small>
        </span>
        <span className="work-metric">{item.metric}</span>
      </button>
      <div className="work-expansion">
        <div>
          {active && <InlineReceipt item={item} />}
        </div>
      </div>
    </article>
  );
}

function PinnedCard({ item }) {
  const href = item.sourceUrl || "#local-router";
  return (
    <article className="pinned-card">
      <a className="pinned-heading" href={href} target={item.sourceUrl ? "_blank" : undefined} rel="noreferrer">
        <RepoIcon size={16} />
        <span>{item.title.toLowerCase().replaceAll(" ", "-")}</span>
        <small>Public</small>
      </a>
      <p>{item.summary}</p>
      <div className="pinned-meta">
        <span><i className="language-dot" /> Python</span>
        <span><StarIcon size={14} /> {item.id === "openscenesense-ollama" ? "52" : item.id === "universal-router" ? "local" : "proof"}</span>
      </div>
    </article>
  );
}

export function App() {
  const [routerState, setRouterState] = useState("idle");
  const [routerStatus, setRouterStatus] = useState("not loaded");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [activity, setActivity] = useState(null);
  const [commandResult, setCommandResult] = useState(null);
  const [conversation, setConversation] = useState([]);
  const workerRef = useRef(null);
  const pendingRef = useRef(new Map());
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => workerRef.current?.terminate();
  }, []);

  const workItems = useMemo(() => selectedWork.map(byId).filter(Boolean), []);

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
        setRouterStatus(`ready · ${message.records} public records`);
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

  function openEvidence(id) {
    setActiveId((current) => current === id ? null : id);
  }

  async function submitPrompt() {
    const prompt = query.trim();
    if (!prompt) return;
    if (routerState !== "ready") {
      setCommandResult({
        answer: "Load the 9.73 MB local AI first. It runs in this tab and calls no paid API.",
        sources: [],
      });
      return;
    }

    setCommandResult(null);
    setActivity({ stage: "understanding", text: "understanding the question" });
    const previousTurn = conversation.at(-1);
    const history = previousTurn
      ? `Earlier question: ${previousTurn.question.slice(0, 120)} Earlier answer: ${previousTurn.answer.slice(0, 260)}`
      : "";
    const priorIds = conversation.at(-1)?.sources?.map((source) => source.id) || [];
    try {
      const decision = await askProfile(prompt, history, priorIds);
      setCommandResult(decision);
      setConversation((current) => [...current, {
        question: prompt, answer: decision.answer, sources: decision.sources,
      }].slice(-3));
      setRouterStatus(`ready · ${decision.corpusSize} public records`);
      setActivity(null);
    } catch {
      setRouterState("error");
      setRouterStatus("local runtime unavailable");
      setActivity(null);
      setCommandResult({
        answer: "The browser runtime stopped. No remote fallback was called, and the static public evidence remains available.",
        sources: [],
      });
    }
  }

  const commandBusy = Boolean(activity);

  return (
    <div className="site-shell">
      <a className="skip-link" href="#overview">Skip to profile</a>
      <header className="identity-bar">
        <a className="identity-mark" href="#overview" aria-label="Rohit Mahendra, profile overview">
          <span className="identity-monogram" aria-hidden="true">RM</span>
          <span className="identity-copy">
            <strong>Rohit Mahendra</strong>
            <small>public systems notebook</small>
          </span>
        </a>
        <nav aria-label="Profile sections">
          <a href="#selected-work">Work</a>
          <a href="#docathon-proof">Proof</a>
          <a href="#local-router">Ask the profile</a>
        </nav>
        <a className="github-profile-link" href={profile.githubUrl} target="_blank" rel="noreferrer">
          <MarkGithubIcon size={18} /> GitHub <ArrowUpRightIcon size={12} />
        </a>
      </header>

      <div className="profile-tabs">
        <div className="tab-spacer" />
        <a className="is-selected" href="#overview"><BookIcon size={17} /> Overview</a>
        <a href={`${profile.githubUrl}?tab=repositories`} target="_blank" rel="noreferrer"><RepoIcon size={17} /> Repositories <small>GitHub</small></a>
        <a href="#selected-work"><ProjectIcon size={17} /> Projects</a>
        <a href="#docathon-proof"><TrophyIcon size={17} /> Proof</a>
      </div>

      <main className="profile-layout" id="overview">
        <aside className="profile-sidebar">
          <img className="avatar" src="./assets/rohit-avatar.png" alt="Rohit Yelukati Mahendra" />
          <h1>{profile.name}</h1>
          <p className="handle">{profile.handle}</p>
          <a className="follow-button" href={profile.githubUrl} target="_blank" rel="noreferrer">Open GitHub profile</a>
          <p className="follow-meta"><RepoIcon size={16} /> Public work · open source</p>
          <ul className="profile-meta">
            <li><BriefcaseIcon size={16} /> AI systems · Python</li>
            <li><ClockIcon size={16} /> United Kingdom</li>
            <li><LinkIcon size={16} /> <a href={profile.coffeeUrl}>buymeacoffee.com/ymrohit</a></li>
            <li><LinkIcon size={16} /> <a href={profile.linkedinUrl}>in/ym-rohit</a></li>
          </ul>
          <div className="achievements">
            <h2>GitHub achievements</h2>
            <div className="achievement-row">
              {achievements.map((achievement) => (
                <img
                  key={achievement.src}
                  src={`./assets/${achievement.src}`}
                  alt={achievement.name}
                  title={`${achievement.name}: ${achievement.detail}`}
                />
              ))}
            </div>
            <p className="achievement-note">YOLO · Starstruck · Pair Extraordinaire · Quickdraw</p>
          </div>
        </aside>

        <section className="profile-main">
          <article className="readme-card">
            <div className="readme-path"><BookIcon size={17} /> <span>ymrohit</span> / README.md</div>
            <div className="readme-body">
              <header className="hero-copy">
                <h2>Hi, I’m Rohit.</h2>
                <p className="hero-line">{profile.tagline}</p>
                <p>{profile.summary}</p>
              </header>

              <a className="docathon-line" id="docathon-proof" href={evidence[0].sourceUrl} target="_blank" rel="noreferrer">
                <TrophyIcon size={16} />
                <span><strong>#1 worldwide</strong> · PyTorch Docathon 2026</span>
                <small>47 points · 19 merged PRs</small>
                <ArrowUpRightIcon size={13} />
              </a>

              <section className="local-router" id="local-router">
                <div className="router-heading">
                  <span><SparklesFillIcon size={14} /> Ask this profile</span>
                  <span className={`router-state ${routerState}`}><i /> {routerStatus}</span>
                  {routerState !== "ready" && (
                    <button type="button" onClick={activateRouter} disabled={routerState === "loading"}>
                      {routerState === "loading" ? "loading…" : "load model"}
                    </button>
                  )}
                </div>
                <p className="runtime-disclosure">
                  <strong>9.73 MB neural planner</strong>
                  <span>runs entirely in this tab</span>
                  <span>no server</span>
                </p>
                <form className="command-line" onSubmit={(event) => { event.preventDefault(); submitPrompt(); }}>
                  <span aria-hidden="true">›</span>
                  <input
                    id="profile-prompt"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onFocus={activateRouter}
                    placeholder="ask about Rohit's work, contributions, or proof"
                    autoComplete="off"
                  />
                  <button type="submit" aria-label="Run local profile query" disabled={commandBusy}>
                    <PaperAirplaneIcon size={16} />
                  </button>
                </form>
                {activity && (
                  <div className="reasoner-activity" data-stage={activity.stage} aria-live="polite">
                    <span className="activity-mark"><i /><i /><i /></span>
                    <span>{activity.text}</span>
                    <small>LIVE IN THIS TAB</small>
                  </div>
                )}
                {commandResult && (
                  <div className="profile-answer" aria-live="polite">
                    <p>{commandResult.answer}</p>
                    {commandResult.sources?.length > 0 && (
                      <div className="answer-sources" aria-label="Public sources">
                        <span>Sources</span>
                        {commandResult.sources.map((source) => source.url ? (
                          <a href={source.url} target="_blank" rel="noreferrer" key={source.id}>
                            {source.title.replace(/[—–]/g, "-")} <ArrowUpRightIcon size={11} />
                          </a>
                        ) : (
                          <span className="source-label" key={source.id}>{source.title.replace(/[—–]/g, "-")}</span>
                        ))}
                      </div>
                    )}
                    {commandResult.verified && (
                      <small className="answer-proof">
                        verified in this tab · {commandResult.evidenceRead} records read · {commandResult.latencyMs} ms
                      </small>
                    )}
                  </div>
                )}
              </section>

              <section className="selected-work" id="selected-work">
                <div className="section-heading">
                  <h3>Selected work</h3>
                </div>
                <div className="work-list">
                  {workItems.map((item) => (
                    <ProjectRow
                      key={item.id}
                      item={item}
                      active={item.id === activeId}
                      onOpen={openEvidence}
                    />
                  ))}
                </div>
              </section>
            </div>
          </article>

          <section className="pinned-section">
            <h2>Pinned</h2>
            <div className="pinned-grid">
              {pinnedIds.map((id) => <PinnedCard key={id} item={byId(id)} />)}
            </div>
          </section>
        </section>
      </main>
      <footer className="site-footer">
        <span>Private by construction: no analytics, cookies, or prompt transmission.</span>
        <a href="https://github.com/ymrohit/ymrohit.github.io" target="_blank" rel="noreferrer">
          View source <ArrowUpRightIcon size={11} />
        </a>
      </footer>
    </div>
  );
}
