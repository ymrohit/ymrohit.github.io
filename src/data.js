export const profile = {
  name: "Rohit Yelukati Mahendra",
  handle: "ymrohit",
  tagline: "I build AI systems that prove their work.",
  descriptor: "PYTHON · AI SYSTEMS · OPEN SOURCE",
  summary:
    "From verified code and GPU kernels to browser-local intelligence, I turn ambitious ideas into systems people can inspect, run, and trust.",
  githubUrl: "https://github.com/ymrohit",
  linkedinUrl: "https://www.linkedin.com/in/ym-rohit",
  coffeeUrl: "https://buymeacoffee.com/ymrohit",
};

export const evidence = [
  {
    id: "docathon-2026",
    type: "achievement",
    title: "PyTorch Docathon 2026",
    eyebrow: "OFFICIAL GLOBAL LEADERBOARD",
    summary: "1st place worldwide with 47 points across 19 merged documentation PRs.",
    detail:
      "Rohit led the complete 2026 PyTorch Docathon leaderboard and was also the pytorch/pytorch repository leader with 31 points.",
    metric: "#1 WORLDWIDE",
    secondaryMetric: "47 PTS · 19 PRS",
    tags: ["python", "open-source", "documentation"],
    sourceUrl: "https://docs.pytorch.org/docs/docathons/docathon-leaderboard-2026.html",
    linkLabel: "Official leaderboard",
    icon: "trophy",
  },
  {
    id: "crucible-studio",
    type: "project",
    title: "CRUCIBLE STUDIO",
    eyebrow: "VERIFIER-FIRST CODE GENERATION",
    summary: "Generated code, verified by execution against blind adversarial tests.",
    detail:
      "Crucible treats the evaluator as the product: generated applications must survive execution and hidden tests, producing a measured +13.3 pass@1 improvement and 4/4 runnable products.",
    metric: "+13.3 PASS@1",
    secondaryMetric: "4/4 RUNNABLE",
    tags: ["verification", "python", "ai-systems"],
    sourceUrl: "https://github.com/ymrohit/crucible-studio",
    linkLabel: "Open repository",
    icon: "shield",
    execution: {
      mode: "replay",
      stages: ["generate", "execute", "blind tests", "receipt"],
    },
  },
  {
    id: "ouroboros-kernelsmith",
    type: "project",
    title: "OUROBOROS KERNELSMITH",
    eyebrow: "VERIFIER-GUIDED GPU SYSTEMS",
    summary: "LLM-written Triton kernels, judged by a referee the model cannot edit.",
    detail:
      "A small-model kernel generation system where candidates must pass correctness and stability gates before promotion. The verifier, not persuasive model output, decides what survives.",
    metric: "69 VERIFIED KERNELS",
    secondaryMetric: "STABILITY GATED",
    tags: ["verification", "gpu", "ai-systems"],
    sourceUrl: "https://github.com/ymrohit/ouroboros-kernelsmith",
    linkLabel: "Open repository",
    icon: "cpu",
    execution: {
      mode: "replay",
      stages: ["candidate", "correctness", "stability", "promotion"],
    },
  },
  {
    id: "universal-router",
    type: "project",
    title: "PROFILE REASONER",
    eyebrow: "BROWSER-LOCAL EVIDENCE AI",
    summary: "A 9.73 MB planner reasons over 67 replaceable public records in this tab.",
    detail:
      "This page runs a distilled six-pass evidence planner through ONNX Runtime WASM. It understands unrestricted questions over the public corpus, chooses operations and evidence, keeps follow-up context, rejects unsupported or private claims, and passed 1,040 hidden cases including 80 counterfactual pairs.",
    metric: "9.73 MB · LOCAL",
    secondaryMetric: "80/80 COUNTERFACTUAL",
    tags: ["browser-ai", "local-ai", "reasoning", "verification", "ai-systems"],
    sourceUrl: null,
    linkLabel: "Running on this page",
    icon: "sparkles",
    execution: {
      mode: "live",
      stages: ["classify", "link", "validate", "render"],
    },
  },
  {
    id: "openscenesense",
    type: "project",
    title: "OPENSCENESENSE",
    eyebrow: "STRUCTURED MULTIMODAL INTELLIGENCE",
    summary: "Typed v1.2 video intelligence with budgeted scene selection and strict schema output.",
    detail:
      "OpenSceneSense v1.2 keeps frame selection and budget control local, then uses managed vision providers to return typed summaries, events, telemetry, and resumable stage results through a strict shared JSON Schema.",
    metric: "V1.2 · PYTHON",
    secondaryMetric: "MANAGED PROVIDERS",
    tags: ["multimodal", "python", "ai-systems"],
    sourceUrl: "https://github.com/ymrohit/openscenesense",
    linkLabel: "Open repository",
    icon: "play",
    execution: {
      mode: "replay",
      stages: ["frames + audio", "structured contract", "application output"],
    },
  },
  {
    id: "openscenesense-ollama",
    type: "project",
    title: "OPENSCENESENSE OLLAMA",
    eyebrow: "PRIVATE LOCAL INFERENCE",
    summary: "Private Ollama video intelligence with the same typed v1.2 result contract.",
    detail:
      "The Ollama edition adds model preflight, native structured output, local telemetry, resumable caches, and optional Whisper audio. Its default video install does not require Torch.",
    metric: "V1.2 · LOCAL",
    secondaryMetric: "52 STARS",
    tags: ["multimodal", "local-ai", "python"],
    sourceUrl: "https://github.com/ymrohit/openscenesense-ollama",
    linkLabel: "Open repository",
    icon: "terminal",
    execution: {
      mode: "replay",
      stages: ["local media", "ollama inference", "structured contract"],
    },
  },
];

export const selectedWork = [
  "crucible-studio",
  "ouroboros-kernelsmith",
  "universal-router",
  "openscenesense",
];

export const pinnedIds = [
  "openscenesense-ollama",
  "crucible-studio",
  "ouroboros-kernelsmith",
  "universal-router",
];

export const modeContent = {
  default: {
    label: "Full profile",
    headline: "I build AI systems that prove their work.",
    order: selectedWork,
  },
  cto: {
    label: "CTO lens",
    headline: "I turn uncertain model output into systems with enforceable guarantees.",
    order: ["crucible-studio", "universal-router", "ouroboros-kernelsmith", "openscenesense"],
  },
  researcher: {
    label: "Research lens",
    headline: "I design loops where models propose and independent verifiers decide.",
    order: ["ouroboros-kernelsmith", "crucible-studio", "universal-router", "openscenesense"],
  },
  recruiter: {
    label: "Recruiter lens",
    headline: "A Python and AI systems builder with public, measured proof of execution.",
    order: ["crucible-studio", "universal-router", "openscenesense", "ouroboros-kernelsmith"],
  },
  maintainer: {
    label: "Maintainer lens",
    headline: "I ship public tools, documentation, and evidence that other builders can inspect.",
    order: ["openscenesense", "universal-router", "crucible-studio", "ouroboros-kernelsmith"],
  },
};

export const suggestedPrompts = [
  "Give me Rohit's 30-second proof",
  "Why is the referee the product?",
  "Show me browser-local AI work",
  "Switch to recruiter mode",
];

export function byId(id) {
  return evidence.find((item) => item.id === id) || null;
}
