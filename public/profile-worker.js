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

const CAPABILITY_VOCABULARY = new Set([
  "ability", "abilities", "capable", "capability", "competence", "competencies",
  "expert", "expertise", "good", "skill", "skills", "specialise", "specialize",
  "specialism", "specialty", "strength", "strengths", "strong",
]);
const PROFILE_VOCABULARY = new Set([
  "bio", "builder", "career", "describe", "engineer", "field", "function", "identity",
  "job", "niche", "persona", "pitch", "profile", "professional", "role", "specialist",
  "summary", "who", "worker",
]);
const SYNTHESIS_VOCABULARY = new Set([
  "builds", "coherence", "cohesive", "common", "concept", "connection", "connections",
  "connect", "connected", "denominator", "link", "linked", "links", "logic",
  "elements", "logical", "motif", "motifs", "pattern", "patterns", "pieces", "recurring", "relate",
  "relates", "shape", "shared", "style", "theme", "themes", "thematic", "thread",
  "together", "traits", "unified", "unifying", "variety",
]);
["excel", "excels", "proficiency", "proficient", "range", "technical", "strongest"]
  .forEach((token) => CAPABILITY_VOCABULARY.add(token));
["duties", "practitioner", "responsibilities", "scope"].forEach((token) => PROFILE_VOCABULARY.add(token));
[
  "award", "awards", "based", "certification", "certifications", "college", "competition",
  "competitions", "contact", "degree", "education", "email", "employer", "employment",
  "hobbies", "interest", "interests", "limitation", "limitations", "location", "motivation",
  "research", "study", "university", "weakness", "weaknesses",
].forEach((token) => PROFILE_VOCABULARY.add(token));
[
  "align", "aligned", "approach", "bind", "binds", "bridge", "coherent", "concepts",
  "consistency", "consistent", "connects", "echo", "echoes", "idea", "ideas",
  "interconnect", "interconnects", "line", "method", "narrative", "related", "repeat",
  "repeated", "repeatedly", "similar", "similarities", "similarity", "structure",
  "structural", "thematically", "through", "tie", "ties", "unifies", "unify", "unity", "whole",
].forEach((token) => SYNTHESIS_VOCABULARY.add(token));
const INTENT_VOCABULARY = [...new Set([
  ...CAPABILITY_VOCABULARY, ...PROFILE_VOCABULARY,
  "actual", "actually", "evidence", "patterns", "projects", "receipts", "rohit",
  "through", "work", "what", "does", "is", "he", "his",
])];
const CONCRETE_TYPES = new Set(["achievement", "claim", "contribution", "project", "repository", "workflow"]);
const PERSONA_TYPES = new Set([
  "certification", "community", "contact", "education", "experience", "footprint",
  "interest", "limitation", "origin", "profile", "recognition", "research", "strength",
  "transformation",
]);
const GENERIC_QUERY_TERMS = new Set([
  "across", "any", "build", "built", "can", "demonstrate", "demonstrated", "designed",
  "evidence", "experience", "find", "give", "has", "have", "public", "record", "records",
  "related", "show", "shows", "support", "supports", "system", "systems", "work",
  "approach", "area", "areas", "career", "ceiling", "concise", "connect", "connects",
  "consistent", "consistency",
  "different", "diverse", "diversity", "engineer", "engineering", "general", "identity",
  "impact", "mastery", "medium", "mediums", "overall", "pattern", "patterns", "portrait",
  "pls", "professional", "professionally", "progression", "quality", "range", "role", "scope",
  "shift", "technical", "through-line",
  "line", "project", "projects", "theme", "themes", "through", "ties", "topic", "topics",
  "trend", "wide", "whole", "works",
  "clear", "core", "credible", "demonstrated", "effectively", "evident", "handle", "key",
  "listed", "main", "output", "portfolio", "prove", "shown", "supplied", "visible", "well",
]);
SYNTHESIS_VOCABULARY.forEach((token) => GENERIC_QUERY_TERMS.add(token));
[
  "about", "according", "activity", "actor", "adding", "alone", "another", "appear",
  "appears", "apply", "artifacts", "back", "backed", "backing", "base", "based", "behind",
  "capabilities", "case", "central", "chosen", "claim", "claims", "clearly", "coherently",
  "command", "complex", "conceptually", "concrete", "confirm", "confirmed", "connecting",
  "contributions", "created", "daily", "define", "defines", "defensible", "definitively",
  "demonstrates", "demonstrating", "depth", "docs", "documented", "doing", "domains", "effective",
  "enough", "essence", "establish", "established", "establishes", "examples", "excellence",
  "exists", "facts", "fields", "files", "focus", "footprint", "framework", "handling", "here",
  "highlight", "identify", "impact", "indicate", "indications", "indicator", "items", "level",
  "levels", "list", "living", "looking", "most", "name", "nature", "now", "one", "only",
  "outputs", "over", "owner", "paper", "parts", "performed", "place", "point", "possess",
  "practice", "present", "primary", "problems", "proficiencies", "proof", "proven", "provides",
  "publicly", "pure", "quickly", "real", "receipts", "regarding", "reliable", "reliably",
  "responsibilities", "results", "right", "said", "samples", "say", "see", "seen", "separate",
  "set", "signal", "signals", "solid", "solves", "specific", "specifically", "standpoint",
  "strict", "strictly", "strongest", "substantiated", "substantiate", "successfully", "suggest",
  "summarize", "supported", "tangible", "tasks", "technically", "their", "them", "there", "they",
  "today", "tools", "truly", "type", "typically", "under", "underlying", "use", "uses", "using",
  "various", "verified", "verify", "via", "view", "visibly", "we", "where", "which", "without",
  "working", "would",
].forEach((token) => GENERIC_QUERY_TERMS.add(token));

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

function maxSoftmax(values) {
  const maximum = Math.max(...values);
  const exponentials = [...values].map((value) => Math.exp(value - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  const index = argmax(values);
  return { index, probability: exponentials[index] / total };
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

function personaIntent(value) {
  const lowered = String(value || "").toLowerCase();
  if (/\b(?:age|how old|birthday|date of birth|marital|married|religion|politics|political|salary|nationality|family)\b/.test(lowered)) return "unsupported-personal";
  if (/\b(?:contact|email|e-mail|reach|hire|recruit|get in touch|talk to)\b/.test(lowered)) return "contact";
  if (/\b(?:full|complete|legal)\s+name\b|\bwhat(?:'s| is)\s+(?:rohit(?:'s)?|his)\s+name\b/.test(lowered)) return "name";
  if (/\bwhere\b.{0,25}\b(?:based|located|work|live)\b|\b(?:location|based in)\b/.test(lowered)) return "location";
  if (/\b(?:education|degree|degrees|university|college|studied|study|academic background|qualification|qualifications)\b/.test(lowered)) return "education";
  if (/\b(?:weakness|weaknesses|shortcoming|shortcomings|development area|areas to improve|could improve|needs? to improve|limitations?|large team|team leadership)\b/.test(lowered)) return "limitations";
  if (/\b(?:hobby|hobbies|interest|interests|interested|motivation|motivates|drives|passionate|outside work|care about)\b/.test(lowered)) return "interests";
  if (/\b(?:competition|competitions|awards?|recognition|hackathon|certification|certifications|honours?|honors?|won|wins)\b/.test(lowered)) return "recognition";
  if (/\b(?:research background|academic research|thesis|dissertation|eeg)\b/.test(lowered)) return "research";
  if (/\b(?:github stats|github footprint|public footprint|how many repos|how many repositories|pypi packages|published packages)\b/.test(lowered)) return "footprint";
  if (/\b(?:work history|career history|professional background|employment|employer|company|current job|current role|professional experience|years? of experience|experience does|how (?:long|many years).{0,25}work|work(?:s|ed)? at|role at|xeal pharma|do for a living)\b/.test(lowered)) return "experience";
  if (/\b(?:strength|strengths|expertise|good at|best at|strongest skills?|capabilities)\b/.test(lowered)) return "strengths";
  if (/\b(?:working style|work style|approach to work|kind of engineer)\b/.test(lowered)) return "working-style";
  if (/\b(?:started|get started|early work|before xeal|origin story|background|community work|leadership|beyond code)\b/.test(lowered)) return "background";
  if (/\b(?:who (?:exactly )?is|about rohit|describe rohit|profile of rohit|what is rohit like|what does rohit do|what does he do)\b/.test(lowered)) return "general";
  return "";
}

function editDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + Number(left[row - 1] !== right[column - 1]),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous.at(-1);
}

function semanticQuery(value) {
  let capabilityIntent = false;
  const normalized = String(value || "").replace(/[A-Za-z]+/g, (surface) => {
    const token = surface.toLowerCase();
    if (token === "n") return "and";
    if (STOPWORDS.has(token) || tokenToId?.has(token)) return surface;
    if (INTENT_VOCABULARY.includes(token)) {
      if (CAPABILITY_VOCABULARY.has(token)) capabilityIntent = true;
      return surface;
    }
    if (token.length < 3 || /(est|ed|ing|ly)$/.test(token)) return surface;
    let best = token;
    let bestRatio = 0;
    for (const candidate of INTENT_VOCABULARY) {
      const ratio = 1 - editDistance(token, candidate) / Math.max(token.length, candidate.length);
      if (ratio > bestRatio) {
        best = candidate;
        bestRatio = ratio;
      }
    }
    const skeleton = token.replace(/[aeiou]/g, "");
    const phonetic = token.length <= 4
      ? INTENT_VOCABULARY.find((candidate) => candidate.replace(/[aeiou]/g, "") === skeleton
        && Math.abs(candidate.length - token.length) <= 2)
      : null;
    if (phonetic) best = phonetic;
    if (bestRatio >= 0.82 || (token.length <= 4 && editDistance(token, best) <= 1)
      || (bestRatio >= 0.74 && !/[aeiou]/.test(token)) || phonetic) {
      if (CAPABILITY_VOCABULARY.has(best)) capabilityIntent = true;
      return best;
    }
    return surface;
  });
  const capabilityPhrase = /\bcan\b.{0,30}\bdo\b/i.test(normalized);
  return `${normalized}${capabilityIntent || capabilityPhrase ? " technical capability engineering" : ""}`.replace(/\s+/g, " ").trim();
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

function specificQueryTerms(value) {
  const values = literalTerms(value);
  for (const token of values) {
    if (/[.+#-]/.test(token)) values.delete(token);
  }
  GENERIC_QUERY_TERMS.forEach((token) => values.delete(token));
  CAPABILITY_VOCABULARY.forEach((token) => values.delete(token));
  PROFILE_VOCABULARY.forEach((token) => values.delete(token));
  INTENT_VOCABULARY.forEach((token) => values.delete(token));
  return values;
}

function semanticFamilyForQuestion(value, fallback) {
  const personal = personaIntent(value);
  if (personal && personal !== "unsupported-personal") {
    return [personal === "strengths" ? "capability" : "profile_summary", true];
  }
  const routingValue = String(value || "").replace(/\bprofile owner\b/gi, "owner");
  const queryTerms = terms(routingValue);
  const identityProfile = new Set([
    "bio", "career", "characterise", "characterize", "domain", "duties", "function", "identity",
    "job", "niche", "operates", "persona", "pitch", "practitioner", "profile",
    "responsibilities", "role", "specialist", "specialty", "who", "worker",
  ]);
  const absoluteIdentity = new Set([
    "bio", "identity", "job", "persona", "practitioner", "role", "who", "worker",
  ]);
  const explicitCapability = new Set([
    "abilities", "ability", "capabilities", "capability", "command", "competence", "competencies",
    "excel", "excels", "expert", "expertise", "foundation", "good", "proficiency", "proficient",
    "range", "skill", "skills", "strength", "strengths", "strongest",
  ]);
  const strongSynthesis = new Set([
    "bind", "binds", "bridge", "coherence", "concepts", "connection", "connections", "echo",
    "echoes", "interconnect", "interconnects", "links", "logic", "patterns", "shared", "thread",
    "unified", "unifies", "unify", "unifying", "unity",
  ]);
  const semanticFocus = specificFocusTerms(value);
  inferredPersonTerms(value).forEach((token) => semanticFocus.delete(token));
  const has = (set) => [...queryTerms].some((token) => set.has(token));
  if (has(absoluteIdentity)) return ["profile_summary", true];
  if (queryTerms.has("describe") && !has(SYNTHESIS_VOCABULARY) && !has(explicitCapability)) {
    return ["profile_summary", true];
  }
  if (/\btype\s+of\s+problems?\b/i.test(value)) return ["profile_summary", true];
  if (semanticFocus.size) return ["capability", true];
  if (/\bcan\b.{0,35}\bdo\b/i.test(value)) return ["capability", true];
  if (/\btechnical\s+profile\s+of\b/i.test(value)) return ["capability", true];
  if (has(identityProfile)) return ["profile_summary", true];
  if (has(strongSynthesis)) return ["synthesis", true];
  if (has(explicitCapability)) return ["capability", true];
  if (has(SYNTHESIS_VOCABULARY)) return ["synthesis", true];
  if (queryTerms.has("focus") || queryTerms.has("scope")) return ["profile_summary", true];
  if (/\b(?:core|main|primary|scope)\b.{0,35}\bpractice\b|\bdo(?:es)?\s+for\s+a\s+living\b/i.test(value)) {
    return ["profile_summary", true];
  }
  if (/\b(?:one|an)\s+(?:item|artifact|project)\b.{0,45}\banother\b/i.test(value)) {
    return ["synthesis", true];
  }
  if (/\b(?:pieces?|items?|projects?)\b.{0,35}\bfit\s+together\b/i.test(value)) {
    return ["synthesis", true];
  }
  if (/\b(?:daily|day-to-day)\s+(?:tasks|work|responsibilities)\b/i.test(value)
    || /\b(?:primary|main|professional)\s+work\s+type\b/i.test(value)) {
    return ["profile_summary", true];
  }
  if (has(CAPABILITY_VOCABULARY)) return ["capability", true];
  if ([...queryTerms].some((token) => PROFILE_VOCABULARY.has(token))) return ["profile_summary", true];
  return [fallback, false];
}

function specificFocusTerms(value) {
  const patterns = [
    /\b(?:related to|worked on|work in|experience in|experience with|skills? in|expertise in|proficiency in|fit for|ability in|tasks? involving|strong at|capable of|handles?|knows?|competence in|good at|excels? at|grip on|ability with|ability to do|command of|mastering|strong with|proficient in|base in|skilled at|competence with|strength in|apply|applies|understands?|results using|evidence for|backing for)\s+(.+?)(?:[?.!]|$)/i,
    /\bcan\b.{0,30}\b(?:do|use)\s+(.+?)(?:[?.!]|$)/i,
    /\bcan\s+execute\s+(.+?)(?:[?.!]|$)/i,
    /\bcredible\s+fit\s+between\s+.+?\s+and\s+(.+?)(?:[?.!]|$)/i,
    /\b(?:success|ability|skills?|mastery|edge)\s+(?:with|in|regarding|for|specifically\s+in)\s+(.+?)(?:[?.!]|$)/i,
    /\b(?:effective\s+use\s+of|applying|claim\s+to|skill\s+set\s+includes)\s+(.+?)(?:[?.!]|$)/i,
    /\b(?:proof|output|records?|evidence|receipts?)\b.{0,55}\b(?:that|showing)\b.{0,35}\b(?:does|knows?)\s+(.+?)(?:\s+(?:well|reliably|successfully|effectively)(?:\s+right\s+now)?(?:\s+here)?|[?.!]|$)/i,
    /\b(?:show|shows|establish|establishes)\s+(.+?)\s+(?:skills?|mastery)(?:\s+(?:here|clearly|strictly|today|now))*\s*(?:[?.!]|$)/i,
    /\b(?:mastery\s+(?:of|over)|command\s+(?:of|over)|competent\s+in|skilled\s+in|proficiency\s+with|application\s+of)\s+(.+?)(?:[?.!]|$)/i,
    /\bgrasp\s+(?:of|on)\s+(.+?)(?:[?.!]|$)/i,
    /\b(?:verify|verified)\b.{0,45}\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?['’]s\s+(.+?)(?:[?.!]|$)/,
    /\bevidence\b.{0,50}\bbehind\b.{0,30}\bfor\s+(.+?)(?:[?.!]|$)/i,
    /\bclaims?\s+about\s+.+?\s+and\s+(.+?)(?:[?.!]|$)/i,
    /\bclaims?\s+about\s+(.+?)(?:\s+for\s+.+?)?(?:[?.!]|$)/i,
    /\boutput\b.{0,30}\bsay\s+about\s+.+?\s+and\s+(.+?)(?:[?.!]|$)/i,
    /\bwork\s+proving\s+(.+?)(?:[?.!]|$)/i,
    /\b(?:proof|demonstration)\b.{0,70}\bin\s+(.+?)(?:[?.!]|$)/i,
    /\b(?:shines?\s+brightest|real\s+edge)\b.{0,20}\b(?:in|regarding)\s+(.+?)(?:[?.!]|$)/i,
    /\b(?:is|works?)\s+in\s+(.+?)(?:[?.!]|$)/i,
    /\bstrong\s+technically\s+in\s+(.+?)(?:[?.!]|$)/i,
  ];
  for (const pattern of patterns) {
    const match = String(value || "").match(pattern);
    if (!match) continue;
    let candidate = match[1];
    if (/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:['’]s|\s+s)\b/.test(candidate)) continue;
    candidate = candidate.replace(
      /\s+(?:successfully|effectively|clearly|reliably|substantiated|established|without\s+adding\s+facts|from\s+(?:their\s+)?work\s+samples?|using\s+only\s+public\s+data)\s*$/i,
      "",
    );
    const focused = specificQueryTerms(candidate);
    if (focused.size) return focused;
  }
  return new Set();
}

function inferredPersonTerms(value) {
  const values = new Set();
  const pattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:['’]s|\s+s)\b/g;
  for (const match of String(value || "").matchAll(pattern)) {
    terms(match[1]).forEach((token) => values.add(token));
  }
  return values;
}

function focusOverlapMax(focus, evidence) {
  const meaningful = new Set([...focus].filter((token) =>
    !GENERIC_QUERY_TERMS.has(token) && !STOPWORDS.has(token)
  ));
  let maximum = 0;
  for (const item of evidence) {
    let overlap = 0;
    meaningful.forEach((token) => { if (item.termSet.has(token)) overlap += 1; });
    maximum = Math.max(maximum, overlap);
  }
  return maximum;
}

function focusSupported(focus, evidence) {
  const meaningful = new Set([...focus].filter((token) =>
    !GENERIC_QUERY_TERMS.has(token) && !STOPWORDS.has(token)
  ));
  if (!meaningful.size) return true;
  const required = meaningful.size === 1 ? 1 : Math.max(2, Math.ceil(meaningful.size / 2));
  return focusOverlapMax(meaningful, evidence) >= required;
}

function shouldRefuseSpecific(family, modelSpecific, specificityConfidence,
  explicitFocus, candidateFocus, evidence) {
  if (family !== "capability") return false;
  const explicit = new Set([...explicitFocus].filter((token) =>
    !GENERIC_QUERY_TERMS.has(token) && !STOPWORDS.has(token)
  ));
  const candidate = new Set([...candidateFocus].filter((token) =>
    !GENERIC_QUERY_TERMS.has(token) && !STOPWORDS.has(token)
  ));
  if (modelSpecific) {
    const focus = explicit.size ? explicit : candidate;
    return focus.size > 0 && !focusSupported(focus, evidence);
  }
  if (explicit.size) {
    if (focusOverlapMax(explicit, evidence)) return false;
    return explicit.size >= 2;
  }
  return specificityConfidence < 0.8 && candidate.size >= 2
    && focusOverlapMax(candidate, evidence) === 0;
}

function orderedFocusLabel(question, focus) {
  const ordered = [];
  for (const token of String(question || "").toLowerCase().match(/[a-z0-9]+/g) || []) {
    if (focus.has(token) && !ordered.includes(token)) ordered.push(token);
  }
  return (ordered.length ? ordered : [...focus].sort()).join(" ");
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

function completeClause(value, limit = 220) {
  return concise(value, limit).replace(/[.,;:]+$/, "")
    .replace(/\b(a|an|and|around|for|in|of|or|the|through|to|with)$/i, "")
    .trim().replace(/[.,;:]+$/, "").trim();
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
  if (/\b(private|home address|street address|phone number|mobile number|dox|precise location|location data)\b/.test(lowered)) return "refuse";
  if (/\b(compare|contrast|versus|vs\.?)\b|\bdifference\s+between\b|\bdifferent\s+from\b/.test(lowered)) return "compare";
  if (/\b(add|total|calculate|arithmetic)\b|\bsum\b(?!\s+up)/.test(lowered)) return "aggregate";
  if (/\b(latest|newest|most recent|chronolog\w*|over time|evolution)\b/.test(lowered)) return "timeline";
  if (/\b(?:did|has|have)\b.{0,35}\bcontribut(?:e|ed|ing)\b|\bcontribut(?:e|ed|ing)\s+(?:to|work)\b|\b(?:show|list|find|any|what|which)\s+(?:me\s+)?(?:his\s+|her\s+)?contributions?\b|\b(upstream|merged\s+pull\s+request|pull request|direct\s+contribution)\b/.test(lowered)) return "intersect";
  // The trained route is advisory. Unsignalled public-profile questions are lookups,
  // matching the Python runtime's guarded query planner.
  return "lookup";
}

function rankDocuments(question, embedding, operation, priorIds = [], specificTerms = new Set()) {
  const queryTerms = terms(question);
  const directQueryTerms = literalTerms(question);
  const lowered = question.toLowerCase();
  const openSourceImpact = (lowered.includes("open-source") || lowered.includes("open source"))
    && /\b(impact|demonstrat\w*|evidence|proof|work)\b/.test(lowered);
  const normalizedQuestion = comparable(question);
  const personal = personaIntent(question);
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
    const personalTypes = {
      contact: ["contact"],
      name: ["profile"],
      location: ["profile", "experience"],
      education: ["education"],
      limitations: ["limitation"],
      interests: ["interest", "origin"],
      recognition: ["achievement", "recognition", "certification"],
      research: ["research", "experience"],
      footprint: ["footprint"],
      experience: ["experience", "transformation"],
      strengths: ["strength", "skill"],
      "working-style": ["strength", "profile"],
      background: ["origin", "community", "education", "recognition"],
      general: ["profile", "experience", "education", "achievement"],
    }[personal] || [];
    if (personalTypes.includes(item.type)) typeBoost += 1.15 - personalTypes.indexOf(item.type) * 0.08;
    else if (personal && PERSONA_TYPES.has(item.type)) typeBoost += 0.08;
    if (/\b(work|project|projects|built|made|example|examples)\b/.test(lowered)) {
      typeBoost += ["project", "contribution"].includes(item.type) ? 0.15 : -0.04;
    }
    if (lowered.includes("browser") && item.type === "project") typeBoost += 0.18;
    if (titleExact && item.type === "project") typeBoost += 0.18;
    if ([...queryTerms].some((token) => CAPABILITY_VOCABULARY.has(token)) && item.type === "skill") typeBoost += 0.42;
    if (lowered.includes("public fork") && item.type === "repository-fork") typeBoost += 0.58;
    else if (lowered.includes("github repository") && item.type === "repository") typeBoost += 0.58;
    else if (lowered.includes("public workflow") && item.type === "workflow") typeBoost += 0.58;
    if (/\b(achievement|win|winner|rank|place|accomplishment)\b/.test(lowered) && item.type === "achievement") typeBoost += 1;
    if (openSourceImpact) {
      if (item.type === "contribution") typeBoost += 0.62;
      else if (["achievement", "claim"].includes(item.type)) typeBoost += 0.24;
      else if (item.type === "repository") typeBoost -= 0.12;
    }
    if (item.type === "repository-fork" && operation === "lookup") typeBoost -= 0.08;
    if (priorIds.includes(item.record_id)) typeBoost += 0.16;
    let focusMatches = 0;
    specificTerms.forEach((token) => { if (item.termSet.has(token)) focusMatches += 1; });
    const neural = dot(item.embedding, embedding);
    return { ...item, lexicalScore: lexical, directLexicalScore: directLexical, directMatches, neuralScore: neural, titleExact,
      score: neural + lexical * 1.2 + directLexical * 1.65 + typeBoost + focusMatches * 1.5
        + (titleExact ? 1.5 : 0) };
  }).sort((left, right) => right.score - left.score);
}

function uniqueRecords(values) {
  const seen = new Set();
  return values.filter((item) => {
    if (!item || seen.has(item.record_id)) return false;
    seen.add(item.record_id);
    return true;
  });
}

function relatedConcrete(skills, ranked, limit = 4) {
  const skillTerms = new Set(skills.flatMap((item) => [...item.termSet]));
  const concrete = ranked.filter((item) => CONCRETE_TYPES.has(item.type));
  const unionRanked = [...concrete].sort((left, right) => {
    const leftOverlap = [...left.termSet].filter((token) => skillTerms.has(token)).length;
    const rightOverlap = [...right.termSet].filter((token) => skillTerms.has(token)).length;
    return rightOverlap - leftOverlap
      || Number(["project", "contribution", "achievement"].includes(right.type))
        - Number(["project", "contribution", "achievement"].includes(left.type))
      || right.score - left.score;
  });
  const selected = [];
  for (const skill of skills) {
    const remaining = concrete.filter((item) => !selected.includes(item)).sort((left, right) => {
      const leftOverlap = [...left.termSet].filter((token) => skill.termSet.has(token)).length;
      const rightOverlap = [...right.termSet].filter((token) => skill.termSet.has(token)).length;
      return rightOverlap - leftOverlap
        || Number(["project", "contribution", "achievement"].includes(right.type))
          - Number(["project", "contribution", "achievement"].includes(left.type))
        || right.score - left.score;
    });
    if (remaining[0]) selected.push(remaining[0]);
  }
  return uniqueRecords([...selected, ...unionRanked]).slice(0, limit);
}

function initialCandidates(ranked) {
  const skills = ranked.filter((item) => item.type === "skill").slice(0, 3);
  const profile = ranked.filter((item) => item.type === "profile").slice(0, 1);
  return uniqueRecords([...ranked.slice(0, 3), ...skills, ...profile, ...relatedConcrete(skills, ranked, 3)]).slice(0, 8);
}

function familyCandidates(family, ranked, personal = "") {
  const skills = ranked.filter((item) => item.type === "skill").slice(0, 3);
  if (family === "capability") {
    const strengths = ranked.filter((item) => item.type === "strength").slice(0, 3);
    const topConcrete = ranked.filter((item) => CONCRETE_TYPES.has(item.type)).slice(0, 2);
    const concrete = uniqueRecords([...topConcrete, ...relatedConcrete(skills, ranked, 4)]).slice(0, 4);
    const interleaved = [];
    for (let index = 0; index < Math.max(skills.length, concrete.length); index += 1) {
      if (skills[index]) interleaved.push(skills[index]);
      if (concrete[index]) interleaved.push(concrete[index]);
    }
    return uniqueRecords([...(personal === "strengths" ? strengths : []), ...interleaved]).slice(0, 8);
  }
  if (family === "profile_summary") {
    const persona = ranked.filter((item) => PERSONA_TYPES.has(item.type)).slice(0, 5);
    const profile = ranked.filter((item) => item.type === "profile").slice(0, 1);
    return uniqueRecords([...persona, ...profile, ...skills.slice(0, 2), ...relatedConcrete(skills, ranked, 2)]).slice(0, 8);
  }
  if (family === "synthesis") {
    const profile = ranked.filter((item) => item.type === "profile").slice(0, 1);
    const synthesisSkills = ranked.filter((item) => item.type === "skill").slice(0, 2);
    const concrete = ranked.filter((item) => CONCRETE_TYPES.has(item.type) && item.type !== "claim");
    const selected = [];
    const types = new Set();
    for (const item of concrete) {
      if (!types.has(item.type) || selected.length >= 2) {
        selected.push(item);
        types.add(item.type);
      }
      if (selected.length === 5) break;
    }
    return uniqueRecords([...profile, ...selected, ...synthesisSkills]).slice(0, 7);
  }
  return ranked.slice(0, 8);
}

function matchReceipts(skills, concrete) {
  const selected = [];
  for (const skill of skills) {
    const remaining = concrete.filter((item) => !selected.includes(item)).sort((left, right) => {
      const leftOverlap = [...skill.termSet].filter((token) => left.termSet.has(token)).length;
      const rightOverlap = [...skill.termSet].filter((token) => right.termSet.has(token)).length;
      return rightOverlap - leftOverlap || right.score - left.score;
    });
    if (remaining[0]) selected.push(remaining[0]);
  }
  return uniqueRecords([...selected, ...concrete]);
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

function renderPersonaAnswer(intent, evidence) {
  const byId = (id) => evidence.find((item) => item.record_id === id);
  const ofType = (...types) => evidence.filter((item) => types.includes(item.type));
  const sourced = (answer, items) => ({
    answer,
    sources: uniqueRecords(items.filter(Boolean)).map(renderSource),
  });
  if (intent === "unsupported-personal") {
    return { answer: "Rohit's public records do not document that personal detail, and this profile will not infer it.", sources: [] };
  }
  if (intent === "contact") {
    const contact = byId("public-contact") || ofType("contact")[0];
    return sourced(
      "For professional enquiries, email Rohit Yelukati Mahendra at mahendrarohittigon@gmail.com. You can also reach him through LinkedIn at linkedin.com/in/ym-rohit or review his work at github.com/ymrohit.",
      [contact],
    );
  }
  if (intent === "name") {
    const profile = byId("profile-rohit") || ofType("profile")[0];
    return sourced("His full name is Rohit Yelukati Mahendra.", [profile]);
  }
  if (intent === "location") {
    const profile = byId("profile-rohit") || ofType("profile")[0];
    const role = byId("xeal-ai-role") || ofType("experience")[0];
    return sourced(
      "Rohit is based in the United Kingdom. His public professional record places his current Xeal Pharma role in Birmingham on a hybrid basis; this profile does not disclose a home address or precise private location.",
      [profile, role],
    );
  }
  if (intent === "education") {
    const education = ofType("education").slice(0, 2);
    return sourced(
      "Rohit earned an MSc in Artificial Intelligence and Robotics from the University of Hertfordshire, where he studied from January 2020 to March 2022. Before that, he completed a BTech in Computer Science at Vidya Jyothi Institute of Technology from 2015 to 2019.",
      education,
    );
  }
  if (intent === "experience") {
    const current = byId("xeal-ai-role") || ofType("experience")[0];
    const earlier = byId("xeal-python-role") || ofType("experience")[1];
    const research = byId("hertfordshire-research-role") || ofType("experience")[2];
    return sourced(
      "Rohit has more than five years at Xeal Pharma. He joined as a Python Developer in August 2021 and progressed to sole Python / AI Developer, owning AI, automation, OCR, Django, analytics, and operational systems from discovery through production. He also worked as a part-time University of Hertfordshire researcher on CNN-assisted cancer-image annotation and completed Bright Network technology internship experience in 2020.",
      [current, earlier, research, byId("bright-network-internship")],
    );
  }
  if (intent === "limitations") {
    const limitation = byId("professional-development-risks") || ofType("limitation")[0];
    return sourced(
      "The public evidence cannot honestly establish a personality weakness. The fairest professional development risk is that broad sole-developer ownership can create bus-factor, documentation, delegation, and team-scale challenges unless it is deliberately countered. Also, many high-impact Xeal systems are private, so outsiders cannot independently inspect every production metric or codebase. These are evidence limits and risks, not proven flaws.",
      [limitation],
    );
  }
  if (intent === "interests") {
    const interest = byId("professional-interests") || ofType("interest")[0];
    const origin = byId("early-product-history") || ofType("origin")[0];
    return sourced(
      "Publicly, Rohit's interests cluster around small capable models, private local AI, verifier-led systems, multimodal understanding, computer vision, developer tooling, and software that removes friction from real operations. His earlier smart-car, grocery, treasure-scan, and smart-pet prototypes show a long-running interest in hands-on products. Private hobbies and favourite media are not documented, so the profile will not invent them.",
      [interest, origin],
    );
  }
  if (intent === "recognition") {
    const docathon = byId("docathon-2026") || ofType("achievement")[0];
    const buildSmall = byId("build-small-2026") || ofType("recognition")[0];
    const innovator = byId("young-innovator-2017") || ofType("recognition")[1];
    const certification = byId("mta-database-fundamentals") || ofType("certification")[0];
    return sourced(
      "Rohit's clearest competition win is first place worldwide in the PyTorch Docathon 2026 with 47 points and 19 merged pull requests. He also received T-Hub Young Innovator recognition in 2017 for Pet Me, participated in Hugging Face's Build Small Hackathon 2026, and earned Microsoft's MTA Database Fundamentals certification in 2018. Build Small is recorded as participation, not a win.",
      [docathon, innovator, buildSmall, certification],
    );
  }
  if (intent === "research") {
    const eeg = byId("eeg-emotion-research") || ofType("research")[0];
    const imaging = byId("hertfordshire-research-role") || ofType("experience")[0];
    const ouroboros = byId("ouroboros-public-results") || ofType("research")[1];
    return sourced(
      "Rohit's research spans EEG emotion recognition, medical image annotation, and verifier-guided GPU kernel generation. His MSc work reported 92% valence, 97.5% arousal, and 90% dominance accuracy on the DREAMER setup. At Hertfordshire he built a CNN-assisted tumour annotation workflow, while OUROBOROS studies whether small models can produce compiler-beating Triton kernels under independent correctness and stability gates.",
      [eeg, imaging, ouroboros],
    );
  }
  if (intent === "footprint") {
    const github = byId("github-public-footprint") || ofType("footprint")[0];
    const pypi = byId("pypi-publications") || ofType("footprint")[1];
    return sourced(
      "As checked on 25 August 2026, ymrohit has 25 public GitHub repositories, 14 public gists, and 257 contributions in the preceding year. Rohit also publishes three PyPI packages: openscenesense, openscenesense-ollama, and ukpostcodeio. Forks are kept separate from work he authored.",
      [github, pypi],
    );
  }
  if (intent === "background") {
    const origin = byId("early-product-history") || ofType("origin")[0];
    const community = byId("infotsav-community") || ofType("community")[0];
    const recognition = byId("young-innovator-2017") || ofType("recognition")[0];
    return sourced(
      "Rohit's builder story started before his professional AI career. From 2016 onward he made mobile, IoT, computer-vision, and consumer prototypes including a smart car, Find My Grocery, Treasure Scan, Pet Me, and See Me. Pet Me received T-Hub Young Innovator recognition in 2017, and in 2019 he coordinated Hyderabad participation for Infotsav hackathon qualifiers.",
      [origin, recognition, community],
    );
  }
  if (intent === "strengths" || intent === "working-style") {
    const strengths = ofType("strength").slice(0, 3);
    const skills = ofType("skill").slice(0, 2);
    const concrete = evidence.filter((item) => CONCRETE_TYPES.has(item.type)).slice(0, 2);
    return sourced(
      "Rohit's strongest evidenced capabilities are end-to-end ownership, translating messy operational needs into production systems, verifier-led AI design, and cross-domain Python engineering. His technical capability areas span backend platforms, local and multimodal AI, OCR and document intelligence, security evaluation, and regulated pharmaceutical workflows. DAX, OUROBOROS, OpenSceneSense, Crucible, and accepted upstream contributions provide concrete receipts rather than résumé-only claims.",
      [...strengths, ...skills, ...concrete],
    );
  }
  if (intent === "general") {
    const profile = byId("profile-rohit") || ofType("profile")[0];
    const role = byId("xeal-ai-role") || ofType("experience")[0];
    const education = byId("msc-ai-robotics") || ofType("education")[0];
    const achievement = byId("docathon-2026") || ofType("achievement")[0];
    return sourced(
      "Rohit Yelukati Mahendra is a UK-based Applied AI Engineer and Python developer with more than five years at Xeal Pharma. As the sole Python / AI Developer, he turns operational problems into secure AI, automation, OCR, Django, analytics, and digital-transformation systems. He holds an MSc in Artificial Intelligence and Robotics, publishes open-source AI tooling, and ranked first worldwide in the PyTorch Docathon 2026 with 47 points across 19 merged pull requests.",
      [profile, role, education, achievement],
    );
  }
  return null;
}

function renderAnswer(question, operation, status, family, evidence, computed, specificTerms = new Set()) {
  const lowered = question.toLowerCase();
  const personal = personaIntent(question);
  if (operation === "refuse" || status === "private") {
    return { answer: "I cannot provide private contact or location data. I can answer questions about Rohit's public work instead.", sources: [] };
  }
  const personalAnswer = renderPersonaAnswer(personal, evidence);
  if (personalAnswer) return personalAnswer;
  if (status === "insufficient") {
    return { answer: "I cannot support that from Rohit's public records. The profile stays inside evidence it can cite.", sources: [] };
  }
  const contentMatch = Math.max(0, ...evidence.map((item) => item.lexicalScore));
  const exactMatch = evidence.some((item) => item.titleExact);
  const namedEvidenceMatch = evidence.some((item) => item.titleExact
    && ["project", "contribution", "achievement"].includes(item.type)
    && comparable(item.display_title).length >= 9);
  const persona = /\b(builder|engineer|persona|identity|profile|who is)\b/.test(lowered);
  const synthesis = wantsSynthesis(question, operation) && !namedEvidenceMatch;
  const synthesisGrounded = synthesis && (contentMatch > 0 || questionTopic(question) === "his public work");
  if (!exactMatch && contentMatch === 0 && !persona && !synthesisGrounded
    && !["capability", "profile_summary", "synthesis"].includes(family)) {
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
  const namedConcreteItems = evidence.filter((item) => item.titleExact && CONCRETE_TYPES.has(item.type));
  const namedConcrete = namedConcreteItems.length > 0;
  if (namedConcrete && operation === "lookup") {
    const item = namedConcreteItems[0];
    return {
      answer: `${item.display_title}: ${sentence(item.display_summary)}`,
      sources: [renderSource(item)],
    };
  }
  if (family === "capability" && !namedConcrete) {
    const skills = evidence.filter((item) => item.type === "skill").slice(0, 3);
    const concrete = evidence.filter((item) => CONCRETE_TYPES.has(item.type) && item.type !== "claim");
    if (specificTerms.size) {
      const matchingSkills = skills.filter((item) => [...specificTerms].some((token) => item.termSet.has(token)));
      const matchingConcrete = concrete.filter((item) => [...specificTerms].some((token) => item.termSet.has(token)));
      const matching = uniqueRecords([
        ...matchingSkills.slice(0, 1), ...matchingConcrete.slice(0, 3), ...matchingSkills.slice(1),
      ]);
      if (matching.length) {
        const supported = new Set(matching.flatMap((item) => [...item.termSet]));
        const labelTerms = new Set([...specificTerms].filter((token) => supported.has(token)));
        const focusLabel = orderedFocusLabel(question, labelTerms) || "that capability";
        const answer = `Rohit's public record supports ${focusLabel} work. The matching evidence is `
          + matching.slice(0, 3).map((item) =>
            `${item.display_title}: ${sentence(completeClause(item.display_summary, 155))}`
          ).join(" ");
        return { answer, sources: matching.slice(0, 3).map(renderSource) };
      }
    }
    const receiptsOnly = /\b(?:receipts?|projects?|artifacts?)\s+(?:alone|only)\b|\b(?:from|using)\s+(?:receipts?|projects?|artifacts?)\s+(?:alone|only)\b|\blist\s+the\s+artifacts?\b/i.test(question);
    const evaluative = /\b(?:mastery|master|command|competence|strong\s+performance|proves?|confirms?)\b/i.test(question);
    let receipts = matchReceipts(
      skills,
      concrete,
    ).slice(0, 2);
    if (specificTerms.size) {
      receipts = receipts.filter((item) => [...specificTerms].some((token) => item.termSet.has(token)));
    }
    if (receiptsOnly && receipts.length) {
      let answer = "The matching public artifact is " + receipts.map((item) =>
        `${item.display_title}: ${sentence(completeClause(item.display_summary, 180))}`
      ).join(" ");
      if (evaluative) {
        answer += " This documents relevant work, but the artifact alone does not establish unqualified mastery or competence.";
      }
      return { answer, sources: receipts.map(renderSource) };
    }
    const singularBest = /\b(?:most\s+credible|strongest|best[- ]supported|primary|main)\b.{0,30}\b(?:strength|area|capability|skill)\b/i.test(question);
    if (singularBest && skills.length) {
      const receiptTerms = new Set(receipts.flatMap((item) => [...item.termSet]));
      const strongest = [...skills].sort((left, right) =>
        [...right.termSet].filter((token) => receiptTerms.has(token)).length
        - [...left.termSet].filter((token) => receiptTerms.has(token)).length
      )[0];
      if (receipts.length) {
        const matched = receipts.filter((item) => [...item.termSet].some((token) => strongest.termSet.has(token)));
        receipts = (matched.length ? matched : receipts).slice(0, 1);
      }
      let answer = `The strongest area supported by this result is ${strongest.display_title}. `
        + `${strongest.display_title}: ${sentence(completeClause(strongest.display_summary, 180))}`;
      if (receipts.length) {
        answer += " The matching public record is " + receipts.map((item) =>
          `${item.display_title}: ${sentence(completeClause(item.display_summary, 180))}`
        ).join(" ");
      }
      return { answer, sources: uniqueRecords([strongest, ...receipts]).map(renderSource) };
    }
    if (skills.length) {
      let answer = "Rohit's supplied records list these technical capability areas: "
        + `${joinPhrases(skills.map((item) => item.display_title))}. `
        + skills.map((item) =>
          `${item.display_title}: ${sentence(completeClause(item.display_summary, 115))}`
        ).join(" ");
      if (receipts.length) {
        answer += " Supporting public records in this result include " + receipts.map((item) =>
          `${item.display_title}: ${sentence(completeClause(item.display_summary, 115))}`
        ).join(" ");
      }
      if (evaluative) {
        answer += " This supports a narrow claim about documented work, not an unqualified claim of mastery, command, or overall competence.";
      }
      return { answer, sources: uniqueRecords([...skills, ...receipts]).slice(0, 6).map(renderSource) };
    }
  }
  if (family === "profile_summary" && !namedConcrete) {
    const profile = evidence.find((item) => item.type === "profile");
    const skills = evidence.filter((item) => item.type === "skill").slice(0, 2);
    const concrete = evidence.filter((item) => CONCRETE_TYPES.has(item.type)).slice(0, 2);
    const projectsOnly = /\b(?:using|from)\s+only\b.{0,35}\bprojects?\b|\bonly\s+(?:the\s+)?visible\s+projects?\b|\bprojects?\s+only\b/i.test(question);
    const artifactView = /\b(?:artifacts?|contributions?|outputs?|projects?|work\s+samples?)\b/i.test(question);
    if (projectsOnly && concrete.length) {
      return {
        answer: "Using only visible project evidence, Rohit's documented focus includes "
          + `${joinPhrases(concrete.map((item) => item.display_title))}.`,
        sources: concrete.map(renderSource),
      };
    }
    if (artifactView && concrete.length) {
      const livingQuestion = /\bdo(?:es)?\s+for\s+a\s+living\b/i.test(question);
      let answer = livingQuestion
        ? "The supplied artifacts do not establish Rohit's occupation. They document work represented by "
        : "Based only on the supplied public artifacts, the visible role is work represented by ";
      answer += `${joinPhrases(concrete.map((item) => item.display_title))}. `;
      answer += concrete.map((item) =>
        `${item.display_title}: ${sentence(completeClause(item.display_summary, 180))}`
      ).join(" ");
      return { answer, sources: concrete.map(renderSource) };
    }
    if (profile) {
      let answer = sentence(concise(profile.display_summary, 300));
      if (/\b(?:daily|day-to-day)\s+(?:tasks|work|responsibilities)\b/i.test(question)) {
        answer = "The supplied public records do not document Rohit's daily tasks. " + answer;
      }
      if (/\b(?:serve|serves|audience|client|clients)\b/i.test(question)) {
        answer = "The supplied records do not identify a specific audience or clients. " + answer;
      }
      if (skills.length) answer += ` His public evidence is strongest around ${joinPhrases(skills.map((item) => item.display_title))}.`;
      if (concrete.length) answer += ` Concrete receipts include ${joinPhrases(concrete.map((item) => item.display_title))}.`;
      return { answer, sources: uniqueRecords([profile, ...skills, ...concrete]).slice(0, 6).map(renderSource) };
    }
  }
  if (family === "synthesis" && !namedConcrete) {
    const profile = evidence.find((item) => item.type === "profile");
    const concrete = evidence.filter((item) => CONCRETE_TYPES.has(item.type)).slice(0, 3);
    if (concrete.length >= 2) {
      const areaNames = concrete.map((item) => item.display_title.replace(/\s+Evidence Project$/i, ""));
      const causalQuestion = /\b(?:support|caus|depend|enable|lead\s+to)\b|\b(?:one|an)\s+(?:item|artifact|project)\b.{0,45}\banother\b/i.test(question);
      let answer = profile
        ? `The explicit profile-level through-line is: ${sentence(completeClause(profile.display_summary, 230))} `
        : "The supplied records do not name a single technical concept shared by these items. ";
      answer += `That pattern appears in ${joinPhrases(areaNames)}. `;
      if (causalQuestion) {
        answer += "The records do not state that one item supports another or establish a deeper shared goal. ";
      }
      answer += "Concrete evidence is " + concrete.map((item) =>
        `${item.display_title}: ${sentence(completeClause(item.display_summary, 125))}`
      ).join(" ");
      return { answer, sources: uniqueRecords([...(profile ? [profile] : []), ...concrete]).map(renderSource) };
    }
  }
  if (family === "domain_positive") {
    const skills = evidence.filter((item) => item.type === "skill").slice(0, 1);
    const concrete = evidence.filter((item) => CONCRETE_TYPES.has(item.type)).slice(0, 3);
    if (skills.length && concrete.length) {
      const answer = `${skills[0].display_title} is supported by multiple public records. `
        + `Concrete receipts include ${concrete.map((item) => `${item.display_title}: ${sentence(completeClause(item.display_summary, 150))}`).join(" ")}`;
      return { answer, sources: [skills[0], ...concrete].map(renderSource) };
    }
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
  const modelQuestion = semanticQuery(question);
  const personal = personaIntent(modelQuestion);
  post("progress", { id, stage: "understanding", text: "understanding the question" });
  const queryText = `QUESTION: ${losslessText(modelQuestion)}\n${activeHistory ? `CONTEXT: ${losslessText(activeHistory)}\n` : ""}`;
  const query = await inferText(queryText);
  const modelOperation = config.operations[argmax(query.output.operation_logits.data)];
  const baseAnswerFamilyCount = config.baseAnswerFamilyCount || 11;
  const sidecarOutput = query.output.sidecar_family_logits?.data;
  const sidecarFamilyLogits = sidecarOutput?.length
    ? Array.from(sidecarOutput)
    : Array.from(query.output.family_logits.data).slice(baseAnswerFamilyCount);
  const queryFamilyDecision = maxSoftmax(sidecarFamilyLogits);
  const modelQueryFamily = config.answerFamilies[baseAnswerFamilyCount + queryFamilyDecision.index];
  const specificityOutput = query.output.sidecar_specificity_logits?.data;
  const specificityDecision = specificityOutput?.length
    ? maxSoftmax(Array.from(specificityOutput))
    : { index: 0, probability: 0 };
  const modelSpecific = specificityDecision.index === 1;
  const explicitTerms = specificFocusTerms(modelQuestion);
  const candidateTerms = specificQueryTerms(modelQuestion);
  const [semanticCandidate, semanticFamily] = semanticFamilyForQuestion(modelQuestion, modelQueryFamily);
  let queryFamily;
  let semantic = semanticFamily;
  if (explicitTerms.size) {
    queryFamily = "capability";
    semantic = true;
  } else if (semantic) {
    queryFamily = semanticCandidate;
  } else if (modelSpecific) {
    queryFamily = "capability";
    semantic = true;
  } else {
    queryFamily = modelQueryFamily;
  }
  if (semantic) queryFamilyDecision.probability = 1;
  const specificTerms = queryFamily === "capability"
    && (modelSpecific || explicitTerms.size || candidateTerms.size)
    ? (explicitTerms.size ? explicitTerms : candidateTerms)
    : new Set();
  let operation = guardOperation(modelQuestion, modelOperation);
  post("progress", { id, stage: "reading", text: `reading ${documents.length} public records` });
  let ranked = rankDocuments(
    modelQuestion, query.output.retrieval_embedding.data, operation, activePriorIds, specificTerms,
  );
  const exactProject = ranked.slice(0, 4).find((item) => item.type === "project" && item.titleExact);
  if (exactProject && operation === "intersect") {
    operation = "lookup";
    ranked = rankDocuments(
      modelQuestion, query.output.retrieval_embedding.data, operation, activePriorIds, specificTerms,
    );
  }
  const achievementIntent = /\b(achievement|win|winner|rank|place|accomplishment)\b/i.test(modelQuestion);
  const exactNamed = ranked.slice(0, 3).some((item) => item.titleExact
    && (CONCRETE_TYPES.has(item.type) || item.type === "repository-fork"));
  const capabilityIntent = [...terms(modelQuestion)].some((token) => CAPABILITY_VOCABULARY.has(token));
  const profileIntent = [...terms(modelQuestion)].some((token) => PROFILE_VOCABULARY.has(token));
  const hintedFamily = operation === "lookup" && personal && personal !== "unsupported-personal"
    ? (personal === "strengths" ? "capability" : "profile_summary")
    : operation === "lookup" && !exactNamed && !achievementIntent && capabilityIntent
    ? "capability"
    : operation === "lookup" && !exactNamed && !achievementIntent && profileIntent
    ? "profile_summary"
    : operation === "lookup" && !exactNamed && !achievementIntent
    && queryFamilyDecision.probability >= 0.55
    ? queryFamily : null;
  let candidates;
  if (operation === "aggregate") {
    candidates = ranked.filter((item) => item.type === "contribution" && item.merged_prs > 0).slice(0, 6);
  } else if (achievementIntent) {
    candidates = uniqueRecords([
      ...ranked.filter((item) => item.type === "achievement"),
      ...ranked.filter((item) => !["skill", "profile"].includes(item.type)),
    ]).slice(0, 6);
  } else if (hintedFamily) {
    candidates = familyCandidates(hintedFamily, ranked, personal);
  } else {
    candidates = initialCandidates(ranked);
  }
  let computed = toolResult(operation, candidates);
  let evidence = compactEvidence(modelQuestion, activeHistory, candidates, computed);
  let parts = sourceParts(modelQuestion, activeHistory, evidence, computed);
  post("progress", { id, stage: "reasoning", text: `reasoning across ${evidence.length} evidence records` });
  let decision = await inferText(parts.source, parts.focusStart, parts.focusEnd);
  let status = config.statuses[argmax(decision.output.status_logits.data)];
  let family = config.answerFamilies[argmax(decision.output.family_logits.data)];
  if (hintedFamily && status === "grounded") family = hintedFamily;
  const injection = /\b(?:ignore|bypass|disregard)\b.{0,60}\b(?:evidence|instruction|rules?)\b|\b(?:invent|fabricate|make up)\b/i.test(question);
  if (injection) {
    status = "insufficient";
    family = "insufficient";
    evidence = [];
    computed = "";
  } else {
    const namedConcrete = evidence.some((item) => item.titleExact
      && (CONCRETE_TYPES.has(item.type) || item.type === "repository-fork"));
    if (status === "grounded" && !namedConcrete && ["capability", "profile_summary", "synthesis"].includes(family)) {
      candidates = familyCandidates(family, ranked, personal);
      computed = toolResult(operation, candidates);
      evidence = compactEvidence(modelQuestion, activeHistory, candidates, computed);
      parts = sourceParts(modelQuestion, activeHistory, evidence, computed);
      decision = await inferText(parts.source, parts.focusStart, parts.focusEnd);
      status = config.statuses[argmax(decision.output.status_logits.data)];
    }
  }
  if (status === "grounded" && family === "capability" && specificTerms.size) {
    const matchingConcrete = ranked.filter((item) =>
      CONCRETE_TYPES.has(item.type) && [...specificTerms].some((token) => item.termSet.has(token))
    ).slice(0, 3);
    evidence = uniqueRecords([...evidence, ...matchingConcrete]);
  }
  if (/\b(achievement|win|winner|rank|place|accomplishment|strongest\s+verified)\b/i.test(modelQuestion)
    && evidence.some((item) => item.type === "achievement")) {
    family = "achievement";
  }
  if (personal && personal !== "unsupported-personal" && operation === "lookup"
    && evidence.some((item) => PERSONA_TYPES.has(item.type) || item.type === "achievement")) {
    status = "grounded";
    family = personal === "strengths" ? "capability" : "profile_summary";
  }
  const exactMatch = evidence.some((item) => item.titleExact);
  const refuseSpecific = shouldRefuseSpecific(
    queryFamily, modelSpecific, specificityDecision.probability,
    explicitTerms, candidateTerms, evidence,
  );
  if (operation === "lookup" && !exactMatch && refuseSpecific) {
    status = "insufficient";
    family = "insufficient";
    evidence = [];
    computed = "";
  }
  post("progress", { id, stage: "writing", text: "writing from public evidence" });
  const rendered = renderAnswer(question, operation, status, family, evidence, computed, specificTerms);
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
    post("ready", { records: documents.length, bundleBytes: config.bundleBytes });
    return;
  }
  post("progress", { stage: "loading", text: "loading the local neural planner" });
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
  post("progress", {
    stage: "loading",
    text: `loading the ${(config.bundleBytes / 1_000_000).toFixed(2)} MB planner`,
  });
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
  post("ready", { records: documents.length, bundleBytes: config.bundleBytes });
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
