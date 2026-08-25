# Rohit AI Profile

Rohit Mahendra's minimalist evidence-first portfolio, with a small neural planner that runs entirely in the browser.

**Live site:** [ymrohit.github.io](https://ymrohit.github.io/)

## What ships

- a 10.95 MB ONNX evidence planner;
- 70 replaceable public-work records;
- neural retrieval with literal evidence constraints;
- multi-record synthesis and short follow-up context;
- compact source receipts and private-data refusal;
- a locally packaged ONNX Runtime Web engine;
- no inference server, paid API, analytics, cookies, or prompt transmission.

The frozen model cleared 1,147 fresh validation and hidden cases, including 120 counterfactual pairs, plus 82 real-profile acceptance checks. Every exported ONNX output matches the PyTorch checkpoint on the parity suite. The browser receives only the planner export, vocabulary, runtime, and replaceable evidence corpus.

## Run locally

```bash
npm ci
npm run dev
```

The first command installs ONNX Runtime Web. The development and production scripts copy only the required WASM assets into the public bundle.

## Validate

```bash
npm run build
npm run test:sites
python tests/profile_e2e.py
```

The Chrome integration test verifies real model loading, live reasoning stages, expertise, identity, portfolio synthesis, contributions, image-processing work, browser-local AI, unsupported-domain refusal, Docathon facts, evidence caveats, prompt injection, private-data refusal, answer style, sources, and mobile layout.

Set `PROFILE_URL=https://ymrohit.github.io/` to run the same suite against the deployed site.
