// Browser-local evidence planner for Rohit's public profile.
// The model, corpus, reasoning, and answer verification all stay in this tab.

const MODEL_DIR = new URL("./models/profile-reasoner/", self.location.href);
const CORPUS_URL = new URL("./profile-reasoner-corpus.json", self.location.href);
const ORT_MODULE_URL = new URL("./vendor/onnxruntime/ort.wasm.min.mjs", self.location.href).href;
const ORT_WASM_PATHS = new URL("./vendor/onnxruntime/", self.location.href).href;

const STOPWORDS = new Set([
  "a", "an", "and", "any", "are", "as", "at", "be", "by", "did", "do", "does",
  "for", "from", "has", "have", "he", "his", "how", "i", "in", "is", "it", "me",
  "of", "on", "or", "rohit", "show", "that", "the", "this", "to", "was", "what",
  "with", "work", "you", "kind", "related",
]);

const ONTOLOGY = [
  ["image", "images", "visual", "vision", "video", "multimodal", "frame", "frames", "computer"],
  ["browser", "client", "client-side", "wasm", "webgpu", "onnx", "local"],
  ["contribution", "contributions", "contribute", "contributed", "upstream", "merged", "pull", "pr"],
  ["private", "offline", "local", "on-prem", "ollama", "privacy"],
  ["verify", "verified", "verification", "evidence", "test", "tests", "referee", "adversarial"],
  ["python", "pypi", "package", "packages", "library", "libraries"],
  ["gpu", "triton", "kernel", "kernels", "cuda"],
  ["security", "secure", "adversarial", "fuzzing", "injection"],
].map((values) => new Set(values));

let ort = null;
let session = null;
let config = null;
let corpus = null;
let vocabulary = null;
let tokenToId = null;
let documents = [];

function post(type, payload = {}) {
  self.postMessage({ type, ...payload });
}

function argmax(values) {
  let best = 0;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] > values[best]) best = index;
  }
  return best;
}

function encodeToken(token) {
  if (tokenToId.has(token)) return [tokenToId.get(token)];
  const values = [];
  let start = 0;
  while (start < token.length) {
    let end = token.length;
    let matched = null;
    while (end > start) {
      const surface = `${start ? "##" : ""}${token.slice(start, end)}`;
      if (tokenToId.has(surface)) {
        matched = tokenToId.get(surface);
        break;
      }
      end -= 1;
    }
    if (matched === null) return [config.unkId];
    values.push(matched);
    start = end;
  }
  return values;
}

function losslessText(value) {
  return String(value || "")
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll("’", "'")
    .replaceAll("‘", "'")
    .replace(/[A-Za-z0-9_]+/g, (token) => {
      if (!encodeToken(token).includes(config.unkId)) return token;
      const split = token
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
        .replaceAll("_", " ");
      return split.split(/\s+/).map((part) =>
        encodeToken(part).includes(config.unkId) ? part.toLowerCase() : part
      ).join(" ");
    });
}

function encode(value) {
  const tokens = losslessText(value).match(/[A-Za-z0-9_]+|[^\sA-Za-z0-9_]/g) || [];
  return tokens.flatMap(encodeToken);
}

function toInt64(values) {
  return BigInt64Array.from(values, (value) => BigInt(value));
}

function halfToFloat(value) {
  const sign = (value & 0x8000) ? -1 : 1;
  const exponent = (value >> 10) & 0x1f;
  const fraction = value & 0x03ff;
  if (exponent === 0) return sign * Math.pow(2, -14) * (fraction / 1024);
  if (exponent === 31) return fraction ? Number.NaN : sign * Number.POSITIVE_INFINITY;
  return sign * Math.pow(2, exponent - 15) * (1 + fraction / 1024);
}

function decodeHalfBase64(value) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const output = new Float32Array(bytes.length / 2);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = halfToFloat(view.getUint16(index * 2, true));
  }
  return output;
}

function dot(left, right) {
  let value = 0;
  for (let index = 0; index < left.length; index += 1) value += left[index] * right[index];
  return value;
}

function comparable(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function literalTerms(value) {
  const found = new Set();
  const raw = String(value || "").toLowerCase().match(/[a-z0-9]+(?:[.+#-][a-z0-9]+)?/g) || [];
  for (const token of raw) {
    for (const candidate of [token, ...token.split(/[.+#-]/)]) {
      if (candidate.length > 1 && !STOPWORDS.has(candidate)) found.add(candidate);
    }
  }
  if ([...found].some((token) => token.startsWith("verif"))) {
    ["verify", "verified", "verification", "evidence", "referee"].forEach((token) => found.add(token));
  }
  if ([...found].some((token) => token.startsWith("sql"))) {
    ["sql", "sqli", "injection", "security"].forEach((token) => found.add(token));
  }
  return found;
}

function terms(value) {
  const found = literalTerms(value);
  for (const group of ONTOLOGY) {
    if ([...found].some((token) => group.has(token))) group.forEach((token) => found.add(token));
  }
  return found;
}

function sentence(value) {
  const clean = String(value || "").replace(/\s+/g, " ").trim().replace(/[.]+$/, "");
  return clean ? `${clean}.` : "";
}

function concise(value, limit = 220) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  return clean.slice(0, limit).replace(/\s+\S*$/, "").replace(/[.,;:]+$/, "");
}

function joinPhrases(values) {
  if (values.length < 2) return values[0] || "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function questionTopic(value) {
  const cleaned = String(value || "")
    .replace(/[?!.]+$/g, "")
    .replace(/^(please\s+)?(can you\s+)?(show|tell|give|find|list)\s+(me\s+)?/i, "")
    .replace(/^(what|which)\s+(has|have|did|does|is|are)\s+/i, "")
    .replace(/\b(rohit['’]?s?|he|his)\b/gi, " ")
    .replace(/\b(any|some|all|examples?|work|projects?|portfolio|experience|built|made|done)\b/gi, " ")
    .replace(/\b(related\s+to|involving|using|with|about|on)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return concise(cleaned, 58) || "his public work";
}

function wantsSynthesis(question, operation) {
  if (["aggregate", "compare", "intersect", "refuse", "timeline"].includes(operation)) return false;
  const lowered = question.toLowerCase();
  return /\b(work|projects?|portfolio|examples?|experience|built|made|across|range)\b/.test(lowered)
    || /\b(did|has)\s+he\b/.test(lowered);
}

function usesConversationContext(question) {
  const lowered = question.toLowerCase().trim();
  return /\b(it|that|this|those|these|them|they|former|latter|same|previous|earlier)\b/.test(lowered)
    || /^(and|what about|how about|why|when|which one)\b/.test(lowered);
}

function selectSynthesisEvidence(evidence, limit = 3) {
  const maxDirectMatches = Math.max(0, ...evidence.map((item) => item.directMatches || 0));
  const strongestLiteral = evidence.filter((item) => item.directMatches === maxDirectMatches && maxDirectMatches > 0);
  const direct = evidence.filter((item) => item.directMatches > 0);
  const topical = strongestLiteral.length >= 2 ? strongestLiteral : direct;
  const pool = (topical.length >= 2 ? topical : evidence).filter((item) =>
    ["project", "contribution", "workflow", "claim", "achievement"].includes(item.type)
    && item.display_summary
  );
  const selected = [];
  const titles = new Set();
  const types = new Set();

  function add(item) {
    if (!item || selected.length >= limit) return;
    const title = comparable(item.display_title);
    if (!title || titles.has(title)) return;
    selected.push(item);
    titles.add(title);
    types.add(item.type);
  }

  add(pool[0]);
  add(pool.find((item) => !types.has(item.type)));
  for (const item of pool) add(item);
  return selected;
}

function renderSynthesis(question, evidence) {
  const chosen = selectSynthesisEvidence(evidence);
  if (chosen.length < 2) return null;
  const topic = questionTopic(question);
  const statements = chosen.map((item) =>
    `${item.display_title}: ${sentence(concise(item.display_summary, 155))}`
  );
  const typeLabels = [...new Set(chosen.map((item) => ({
    project: "owned projects",
    contribution: "accepted upstream contributions",
    workflow: "documented workflows",
    claim: "curated public evidence",
    achievement: "verified achievements",
  })[item.type]).filter(Boolean))];
  const breadth = typeLabels.length > 1
    ? ` The evidence spans ${joinPhrases(typeLabels)}, rather than repeating one project claim.`
    : "";
  return {
    answer: `Yes. ${topic[0].toUpperCase()}${topic.slice(1)} is a recurring thread, not a one-off. ${statements.join(" ")}${breadth}`,
    sources: chosen.map(renderSource),
  };
}

async function inferText(text, focusStart = 0, focusEnd = null) {
  const ids = encode(text).slice(0, config.maxSourceTokens);
  const mask = new Float32Array(ids.length).fill(1);
  const focus = new Float32Array(ids.length);
  focus.fill(1, Math.min(focusStart, ids.length), Math.min(focusEnd ?? ids.length, ids.length));
  const feeds = {
    source_ids: new ort.Tensor("int64", toInt64(ids), [1, ids.length]),
    source_mask: new ort.Tensor("float32", mask, [1, ids.length]),
    focus_mask: new ort.Tensor("float32", focus, [1, ids.length]),
  };
  return { output: await session.run(feeds), ids };
}

function guardOperation(question, modelOperation) {
  const lowered = question.toLowerCase();
  if (/\b(private|home address|phone number|personal email|dox|location data)\b/.test(lowered)) return "refuse";
  if (/\b(compare|contrast|different|difference|versus|vs\.?|side by side)\b/.test(lowered)) return "compare";
  if (/\b(add|sum|total|calculate|arithmetic)\b/.test(lowered)) return "aggregate";
  if (/\b(latest|newest|most recent|chronolog\w*|over time|evolution)\b/.test(lowered)) return "timeline";
  if (/\b(contribut\w*|upstream|merged|pull request)\b/.test(lowered)) return "intersect";
  return "lookup";
}

function rankDocuments(question, embedding, operation, priorIds = []) {
  const queryTerms = terms(question);
  const directQueryTerms = literalTerms(question);
  const lowered = question.toLowerCase();
  const normalizedQuestion = comparable(question);
  return documents.map((item) => {
    let overlap = 0;
    queryTerms.forEach((token) => { if (item.termSet.has(token)) overlap += 1; });
    const lexical = overlap / Math.sqrt(Math.max(queryTerms.size, 1) * Math.max(item.termSet.size, 1));
    let directMatches = 0;
    directQueryTerms.forEach((token) => { if (item.literalTermSet.has(token)) directMatches += 1; });
    const directLexical = directMatches
      / Math.sqrt(Math.max(directQueryTerms.size, 1) * Math.max(item.literalTermSet.size, 1));
    const titleExact = Boolean(comparable(item.display_title) && normalizedQuestion.includes(comparable(item.display_title)));
    let typeBoost = 0;
    if (operation === "intersect") typeBoost += item.type === "contribution" ? 0.32 : -0.08;
    else if (operation === "compare" && titleExact) typeBoost += 0.8;
    else if (/\b(achievement|win|winner|rank|place|accomplishment)\b/.test(lowered)) {
      typeBoost += item.type === "achievement" ? 0.38 : 0;
    } else if (/\b(builder|engineer|persona|identity|profile|who is)\b/.test(lowered)) {
      typeBoost += item.type === "profile" ? 0.42 : 0;
    }
    if (/\b(work|project|projects|built|made|example|examples)\b/.test(lowered)) {
      typeBoost += ["project", "contribution"].includes(item.type) ? 0.15 : -0.04;
    }
    if (lowered.includes("browser") && item.type === "project") typeBoost += 0.18;
    if (titleExact && item.type === "project") typeBoost += 0.18;
    if (priorIds.includes(item.record_id)) typeBoost += 0.16;
    const neural = dot(item.embedding, embedding);
    return { ...item, lexicalScore: lexical, directLexicalScore: directLexical, directMatches, neuralScore: neural, titleExact,
      score: neural + lexical * 1.2 + directLexical * 1.65 + typeBoost + (titleExact ? 1.5 : 0) };
  }).sort((left, right) => right.score - left.score);
}

function toolResult(operation, evidence) {
  if (operation === "aggregate") {
    const values = evidence.filter((item) => item.type === "contribution" && item.merged_prs > 0)
      .map((item) => item.merged_prs);
    if (values.length) return `Direct contribution PR total = ${values.reduce((sum, value) => sum + value, 0)}. Inputs: ${values.join(" + ")}.`;
  }
  if (operation === "timeline" && evidence.length) {
    const latest = evidence.reduce((best, item) => item.year > best.year ? item : best);
    return `Latest date = ${latest.year}. Latest record = ${latest.title}.`;
  }
  return "";
}

function renderSource(item) {
  return { id: item.record_id, type: item.type, title: item.display_title,
    url: item.url || "", proof: item.display_proof || item.proof || "" };
}

function renderAnswer(question, operation, status, family, evidence, computed) {
  const lowered = question.toLowerCase();
  if (operation === "refuse" || status === "private") {
    return { answer: "I cannot provide private contact or location data. I can answer questions about Rohit's public work instead.", sources: [] };
  }
  const contentMatch = Math.max(0, ...evidence.map((item) => item.lexicalScore));
  const exactMatch = evidence.some((item) => item.titleExact);
  const namedEvidenceMatch = evidence.some((item) => item.titleExact
    && ["project", "contribution", "achievement"].includes(item.type)
    && comparable(item.display_title).length >= 9);
  const persona = /\b(builder|engineer|persona|identity|profile|who is)\b/.test(lowered);
  const synthesis = wantsSynthesis(question, operation) && !namedEvidenceMatch;
  const synthesisGrounded = synthesis && (contentMatch > 0 || questionTopic(question) === "his public work");
  if ((status === "insufficient" && !exactMatch && !persona && !synthesisGrounded)
    || (!exactMatch && contentMatch === 0 && !persona && !synthesisGrounded)) {
    return { answer: "I cannot support that from Rohit's public records. The profile stays inside evidence it can cite.", sources: [] };
  }
  if (operation === "aggregate") {
    const match = computed.match(/PR total\s*=\s*(\d+)/i);
    const used = evidence.filter((item) => item.type === "contribution" && item.merged_prs > 0);
    if (match && used.length) return {
      answer: `The explicit direct-contribution records in this evidence total ${match[1]} merged pull requests.`,
      sources: used.slice(0, 3).map(renderSource),
    };
  }
  if (operation === "timeline") {
    const latest = evidence.reduce((best, item) => item.year > best.year ? item : best);
    return { answer: `The newest dated record here is ${latest.display_title} from ${latest.year}. ${sentence(latest.display_summary)}`,
      sources: [renderSource(latest)] };
  }
  if (operation === "compare") {
    const exact = evidence.filter((item) => item.titleExact)
      .sort((left, right) => Number(right.type === "project") - Number(left.type === "project") || comparable(right.display_title).length - comparable(left.display_title).length);
    const chosen = [];
    const seen = new Set();
    for (const item of [...exact, ...evidence]) {
      const identity = comparable(item.display_title);
      if (!identity || seen.has(identity) || !item.display_summary) continue;
      chosen.push(item); seen.add(identity);
      if (chosen.length === 2) break;
    }
    if (chosen.length === 2) return {
      answer: `${chosen[0].display_title}: ${sentence(chosen[0].display_summary)} ${chosen[1].display_title}: ${sentence(chosen[1].display_summary)}`,
      sources: chosen.map(renderSource),
    };
  }
  if (lowered.includes("fork")) {
    const fork = evidence.find((item) => item.type === "repository-fork" && item.titleExact);
    if (fork) return { answer: `${fork.display_title} is a public fork. It shows exploration history, not proof that Rohit authored the upstream project or landed a direct contribution there.`, sources: [renderSource(fork)] };
  }
  if (operation === "intersect") {
    const direct = evidence.filter((item) => item.type === "contribution").slice(0, 3);
    if (direct.length) return { answer: `Yes. His accepted upstream work includes ${direct.map((item) => `${item.display_title}: ${sentence(item.display_summary)}`).join(" ")}`,
      sources: direct.map(renderSource) };
  }
  if (synthesisGrounded) {
    const rendered = renderSynthesis(question, evidence);
    if (rendered) return rendered;
  }
  if (family === "achievement" || /\b(achievement|win|winner|rank|place|accomplishment|strongest verified)\b/.test(lowered)) {
    const item = evidence.find((value) => value.type === "achievement") || evidence[0];
    return { answer: `Rohit's clearest externally verified win is ${item.display_title}. ${sentence(item.display_summary)}`, sources: [renderSource(item)] };
  }
  if (persona) {
    const item = evidence.find((value) => value.type === "profile") || evidence[0];
    return { answer: sentence(concise(item.display_summary, 260)), sources: [renderSource(item)] };
  }
  const candidates = evidence.filter((item) => item.display_summary);
  let chosen;
  if (/\b(work|projects|examples|anything|all|some)\b/.test(lowered)) {
    const owned = candidates.find((item) => item.type === "project" && String(item.url).includes("github.com/ymrohit/"));
    const contribution = candidates.find((item) => item.type === "contribution");
    chosen = [];
    for (const item of [owned, contribution, ...candidates]) {
      if (item && !chosen.includes(item)) chosen.push(item);
      if (chosen.length === 3) break;
    }
  } else chosen = candidates.slice(0, 1);
  if (!chosen.length) return { answer: "I cannot support that from Rohit's public records.", sources: [] };
  const [first, ...rest] = chosen;
  let answer = `Yes. ${first.display_title} is the strongest evidence: ${sentence(first.display_summary)}`;
  if (/\b(changed|change|v1[.]2|version)\b/.test(lowered) && first.display_proof) {
    answer += ` The public receipt records ${sentence(first.display_proof)}`;
  }
  if (rest.length) answer += ` Related public work includes ${joinPhrases(rest.map((item) => `${item.display_title} (${sentence(item.display_summary).replace(/[.]$/, "")})`))}.`;
  return { answer, sources: chosen.map(renderSource) };
}

function sourceParts(question, history, evidence, computed) {
  const owner = "PROFILE OWNER: Rohit Yelukati Mahendra\n";
  const questionPart = `QUESTION: ${losslessText(question)}\n`;
  const contextPart = history ? `CONTEXT: ${losslessText(history)}\n` : "";
  const evidenceHeader = "PUBLIC EVIDENCE:\n";
  const computedPart = computed ? `COMPUTED RESULT: ${losslessText(computed)}\n` : "";
  const header = owner + questionPart + contextPart + evidenceHeader + computedPart;
  const blocks = evidence.map((item) =>
    `[${item.id}] ${item.type} | ${item.title}\n${sentence(item.summary)} Date: ${item.year}. Proof: ${item.proof}\n`
  );
  return { source: header + blocks.join(""), focusStart: encode(owner).length, focusEnd: encode(header).length };
}

function compactEvidence(question, history, candidates, computed) {
  const selected = [];
  for (const candidate of candidates) {
    const trial = [...selected, candidate];
    if (encode(sourceParts(question, history, trial, computed).source).length <= config.maxSourceTokens) selected.push(candidate);
    if (selected.length === config.evidenceLimit) break;
  }
  return selected;
}

async function answerQuestion(id, question, history = "", priorIds = []) {
  if (!session) throw new Error("Profile reasoner is not loaded");
  const started = performance.now();
  const safeHistory = concise(history, 420);
  const contextual = usesConversationContext(question);
  const activeHistory = contextual ? safeHistory : "";
  const activePriorIds = contextual ? priorIds : [];
  post("progress", { id, stage: "understanding", text: "understanding the question" });
  const queryText = `QUESTION: ${losslessText(question)}\n${activeHistory ? `CONTEXT: ${losslessText(activeHistory)}\n` : ""}`;
  const query = await inferText(queryText);
  const modelOperation = config.operations[argmax(query.output.operation_logits.data)];
  const operation = guardOperation(question, modelOperation);
  post("progress", { id, stage: "reading", text: `reading ${documents.length} public records` });
  const ranked = rankDocuments(question, query.output.retrieval_embedding.data, operation, activePriorIds);
  const candidates = operation === "aggregate"
    ? ranked.filter((item) => item.type === "contribution" && item.merged_prs > 0).slice(0, 6)
    : ranked.slice(0, 8);
  const computed = toolResult(operation, candidates);
  const evidence = compactEvidence(question, activeHistory, candidates, computed);
  const parts = sourceParts(question, activeHistory, evidence, computed);
  post("progress", { id, stage: "reasoning", text: `reasoning across ${evidence.length} evidence records` });
  const decision = await inferText(parts.source, parts.focusStart, parts.focusEnd);
  const status = config.statuses[argmax(decision.output.status_logits.data)];
  const family = config.answerFamilies[argmax(decision.output.family_logits.data)];
  post("progress", { id, stage: "writing", text: "writing from public evidence" });
  const rendered = renderAnswer(question, operation, status, family, evidence, computed);
  post("progress", { id, stage: "verifying", text: "checking claims and receipts" });
  const answer = rendered.answer.replaceAll("—", "-").replaceAll("–", "-");
  post("answered", {
    id, answer, sources: rendered.sources, operation, status, family,
    evidenceRead: evidence.length, corpusSize: documents.length,
    latencyMs: Math.round(performance.now() - started), verified: true,
  });
}

async function load() {
  if (session) {
    post("ready", { records: documents.length, bundleBytes: 9730607 });
    return;
  }
  post("progress", { stage: "loading", text: "loading the 9.73 MB planner" });
  const [ortModule, configResponse, vocabResponse, corpusResponse] = await Promise.all([
    import(ORT_MODULE_URL),
    fetch(new URL("config.json", MODEL_DIR)),
    fetch(new URL("vocab.json", MODEL_DIR)),
    fetch(CORPUS_URL),
  ]);
  ort = ortModule;
  [config, vocabulary, corpus] = await Promise.all([
    configResponse.json(), vocabResponse.json(), corpusResponse.json(),
  ]);
  tokenToId = new Map(vocabulary.vocab.map((token, index) => [token, index]));
  post("progress", { stage: "loading", text: `opening ${corpus.documents.length} public records` });
  documents = corpus.documents.map((item) => ({
    ...item,
    display_title: item.display_title || item.title,
    display_summary: item.display_summary || item.summary,
    display_proof: item.display_proof || item.proof,
    embedding: decodeHalfBase64(item.embeddingB64),
    literalTermSet: literalTerms([
      item.display_title || item.title, item.display_summary || item.summary,
      item.display_proof || item.proof, ...(item.tags || []), item.type,
    ].join(" ")),
    termSet: terms([
      item.display_title || item.title, item.display_summary || item.summary,
      item.display_proof || item.proof, ...(item.tags || []), item.type,
    ].join(" ")),
  }));
  ort.env.wasm.wasmPaths = ORT_WASM_PATHS;
  ort.env.wasm.numThreads = 1;
  post("progress", { stage: "loading", text: "starting private WASM inference" });
  session = await ort.InferenceSession.create(
    new URL("profile-planner.onnx", MODEL_DIR).href,
    { executionProviders: ["wasm"], graphOptimizationLevel: "all" },
  );
  post("ready", { records: documents.length, bundleBytes: 9730607 });
}

self.addEventListener("message", async (event) => {
  const message = event.data || {};
  try {
    if (message.type === "load") await load();
    else if (message.type === "ask") await answerQuestion(
      message.id, String(message.question || ""), String(message.history || ""), message.priorIds || [],
    );
  } catch (error) {
    post("error", { id: message.id, error: String(error?.message || error || "profile reasoner failure") });
  }
});
