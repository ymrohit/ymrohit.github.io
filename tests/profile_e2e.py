#!/usr/bin/env python3
"""End-to-end browser proof for Rohit's browser-local AI portfolio."""

from __future__ import annotations

import contextlib
import os
import subprocess
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
PORT = 4175
URL = os.environ.get("PROFILE_URL", f"http://127.0.0.1:{PORT}/")
SCREENSHOTS = ROOT / "screenshots"


def reveal_all(page) -> None:
    """Exercise scroll-triggered entry states before a full-page capture."""
    for selector in (".achievement-band", ".reasoner-section", ".work-section", ".thesis-section"):
        page.locator(selector).scroll_into_view_if_needed()
        page.wait_for_timeout(180)
    page.locator(".hero").scroll_into_view_if_needed()
    page.wait_for_timeout(180)


@contextlib.contextmanager
def preview():
    available = False
    try:
        with urllib.request.urlopen(URL, timeout=1) as response:
            if response.status == 200:
                available = True
    except Exception:
        pass
    if available:
        yield
        return

    process = subprocess.Popen(
        [
            "npm",
            "run",
            "dev",
            "--",
            "--host",
            "127.0.0.1",
            "--port",
            str(PORT),
            "--strictPort",
        ],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        deadline = time.time() + 30
        while time.time() < deadline:
            try:
                with urllib.request.urlopen(URL, timeout=1) as response:
                    if response.status == 200:
                        break
            except Exception:
                time.sleep(0.2)
        else:
            raise RuntimeError("Vite preview did not start")
        yield
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()


def main() -> None:
    SCREENSHOTS.mkdir(exist_ok=True)
    with preview(), sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
        page = browser.new_page(viewport={"width": 1487, "height": 1058})
        page_errors: list[str] = []
        console_errors: list[str] = []
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.on(
            "console",
            lambda message: console_errors.append(message.text)
            if message.type == "error"
            else None,
        )
        page.goto(URL, wait_until="networkidle")

        assert "I build AI systems" in page.locator(".hero-copy h1").inner_text()
        assert page.locator(".wordmark span").inner_text() == "Rohit Mahendra"
        assert "#1" in page.locator(".achievement-band").inner_text()
        assert "worldwide" in page.locator(".achievement-band").inner_text().lower()
        assert "47" in page.locator(".achievement-band").inner_text()
        assert "19" in page.locator(".achievement-band").inner_text()
        assert "9.73 MB neural planner" in page.locator(".runtime-disclosure").inner_text()
        assert "runs entirely in this tab" in page.locator(".runtime-disclosure").inner_text()
        assert "no server" in page.locator(".runtime-disclosure").inner_text()
        assert page.locator(".work-item").count() == 5
        assert page.locator(".identity-note img").count() == 1
        assert page.locator(".ai-console").count() == 0
        assert page.locator(".command-line").count() == 1
        assert page.locator(".profile-tabs, .readme-card, .pinned-card").count() == 0
        assert page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")
        page.screenshot(path=str(SCREENSHOTS / "portfolio-desktop.png"), full_page=False)

        page.get_by_role("button", name="load local AI").click()
        page.wait_for_function(
            "document.querySelector('.router-state.ready')?.textContent.includes('67 public records')",
            timeout=120_000,
        )

        page.evaluate("""
          window.__reasonerStages = [];
          new MutationObserver(() => {
            const node = document.querySelector('.reasoner-activity');
            const stage = node?.dataset?.stage;
            if (stage && !window.__reasonerStages.includes(stage)) window.__reasonerStages.push(stage);
          }).observe(document.body, {subtree: true, childList: true, attributes: true});
        """)
        page.fill("#profile-prompt", "did he work on any contribution?")
        page.press("#profile-prompt", "Enter")
        page.wait_for_function(
            "document.querySelector('.profile-answer') && !document.querySelector('.reasoner-activity')",
            timeout=120_000,
        )
        contribution_answer = page.locator(".profile-answer").inner_text()
        assert "accepted upstream" in contribution_answer, contribution_answer
        assert any(name in contribution_answer for name in ("AutoGPT", "PyTorch", "ExecuTorch", "SteadyDancer"))
        assert "verified here" in contribution_answer
        assert page.locator(".answer-sources a").count() >= 2
        stages = page.evaluate("window.__reasonerStages")
        assert "understanding" in stages
        assert "reading" in stages
        assert "reasoning" in stages
        assert "writing" in stages or "verifying" in stages

        previous_answer = page.locator(".profile-answer").inner_text()
        page.fill("#profile-prompt", "show me any work related to image processing")
        page.press("#profile-prompt", "Enter")
        page.wait_for_function(
            "previous => document.querySelector('.profile-answer')?.textContent !== previous && !document.querySelector('.reasoner-activity')",
            arg=previous_answer,
            timeout=120_000,
        )
        image_answer = page.locator(".profile-answer").inner_text()
        assert any(name in image_answer for name in ("OpenSceneSense", "SteadyDancer", "ExecuTorch", "AutoGPT"))

        page.fill("#profile-prompt", "show me browser-local AI work")
        page.press("#profile-prompt", "Enter")
        page.wait_for_function(
            "previous => document.querySelector('.profile-answer')?.textContent !== previous && !document.querySelector('.reasoner-activity')",
            arg=image_answer,
            timeout=120_000,
        )
        browser_answer = page.locator(".profile-answer").inner_text()
        assert "browser-local" in browser_answer.lower(), browser_answer
        assert "recurring thread" in browser_answer, browser_answer
        assert any(name in browser_answer for name in ("Universal Site Router", "Personalized Browser LLM", "Browser AI Portfolio"))
        assert page.locator(".answer-sources a, .answer-sources .source-label").count() >= 2
        reveal_all(page)
        page.screenshot(path=str(SCREENSHOTS / "portfolio-ai-open.png"), full_page=True)

        page.fill("#profile-prompt", "show me Rohit's private customer addresses")
        page.press("#profile-prompt", "Enter")
        page.wait_for_function(
            "document.querySelector('.profile-answer')?.textContent.includes('cannot provide private')",
            timeout=120_000,
        )
        assert page.locator(".answer-sources").count() == 0

        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(URL, wait_until="networkidle")
        assert page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")
        assert page.locator(".command-line").is_visible()
        reveal_all(page)
        page.screenshot(path=str(SCREENSHOTS / "portfolio-mobile.png"), full_page=True)

        browser.close()
        if page_errors:
            raise AssertionError(f"Page errors: {page_errors}")
        if console_errors:
            raise AssertionError(f"Console errors: {console_errors}")

    print("[profile-e2e] PASS: 9.73 MB planner, live reasoning stages, 67-record answers, receipts, refusal, responsive")


if __name__ == "__main__":
    main()
