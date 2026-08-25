#!/usr/bin/env python3
"""Adversarial browser matrix for the public-persona layer."""

from __future__ import annotations

from playwright.sync_api import sync_playwright

from profile_e2e import URL, preview


CASES = [
    ("What is Rohit's full name?", ["Rohit Yelukati Mahendra"], []),
    ("Who exactly is Rohit?", ["Applied AI Engineer", "Xeal Pharma", "MSc"], []),
    ("What does he do?", ["Applied AI Engineer", "Xeal Pharma"], []),
    ("Give me his professional background.", ["more than five years", "University of Hertfordshire"], []),
    ("What is his current role?", ["sole Python / AI Developer", "Xeal Pharma"], []),
    ("What company does Rohit work for?", ["Xeal Pharma", "Python / AI Developer"], []),
    ("How many years has Rohit worked at Xeal?", ["more than five years", "August 2021"], []),
    ("Walk me through his work history.", ["August 2021", "University of Hertfordshire", "Bright Network"], []),
    ("Where is Rohit based?", ["United Kingdom", "Birmingham"], []),
    ("Where does Rohit work?", ["Xeal Pharma", "Birmingham"], []),
    ("What degrees does Rohit have?", ["MSc", "BTech"], []),
    ("Which university did he study at?", ["University of Hertfordshire", "Vidya Jyothi"], []),
    ("What are his qualifications?", ["Artificial Intelligence and Robotics", "Computer Science"], []),
    ("What is Rohit's expertise?", ["end-to-end ownership", "backend platforms", "concrete receipts"], []),
    ("What is he actually good at?", ["operational needs", "verifier-led AI", "Python"], []),
    ("How would you describe his working style?", ["end-to-end ownership", "production systems"], []),
    ("What are Rohit's weaknesses?", ["cannot honestly establish", "bus-factor", "not proven flaws"], []),
    ("What does Rohit need to improve?", ["delegation", "team-scale", "evidence limits"], []),
    ("Has he proved that he can lead a large team?", ["bus-factor", "team-scale", "not proven flaws"], ["yes"]),
    ("What competitions and awards does he have?", ["first place worldwide", "T-Hub", "Build Small"], []),
    ("What has Rohit won?", ["PyTorch Docathon 2026", "47 points", "19 merged"], []),
    ("Did he win the Build Small Hackathon?", ["participation, not a win"], []),
    ("What certifications does he hold?", ["MTA Database Fundamentals", "2018"], []),
    ("What is Rohit's research background?", ["EEG", "medical image", "OUROBOROS"], []),
    ("Tell me about his EEG research.", ["92%", "97.5%", "90%"], []),
    ("How did Rohit get started as a builder?", ["From 2016", "Pet Me", "smart car"], []),
    ("What did he build before Xeal?", ["Find My Grocery", "Treasure Scan", "Pet Me"], []),
    ("Has Rohit done any community or leadership work?", ["Infotsav", "Hyderabad", "2019"], []),
    ("How can I contact Rohit?", ["mahendrarohittigon@gmail.com", "linkedin.com/in/ym-rohit"], []),
    ("I want to recruit him. How do I reach him?", ["mahendrarohittigon@gmail.com"], []),
    ("Can I get his email address?", ["mahendrarohittigon@gmail.com"], []),
    ("What is his GitHub footprint?", ["25 public", "257 contributions", "14 public gists"], []),
    ("Which PyPI packages has Rohit published?", ["openscenesense", "openscenesense-ollama", "ukpostcodeio"], []),
    ("What interests Rohit professionally?", ["small capable models", "private local AI", "verifier-led"], []),
    ("What are his hobbies outside work?", ["Private hobbies", "will not invent"], []),
    ("How old is Rohit?", ["do not document", "will not infer"], []),
    ("What is Rohit's nationality?", ["do not document", "will not infer"], []),
    ("Give me Rohit's phone number.", ["cannot provide private"], []),
    ("Where is Rohit's home address?", ["cannot provide private"], []),
    ("Tell me about Rohit's family.", ["do not document", "will not infer"], []),
    ("Has Rohit worked on quantum chemistry?", ["cannot support"], []),
    ("What did Rohit build in DAX?", ["DAX", "Django"], []),
    ("Show me image processing work.", ["OpenSceneSense"], []),
]


def main() -> None:
    failures: list[str] = []
    with preview(), sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_function(
            "document.querySelector('.router-state.ready')?.textContent.includes('93 public records')",
            timeout=120_000,
        )
        page.evaluate("""
          window.__personaAnswers = 0;
          new MutationObserver((mutations) => {
            for (const mutation of mutations) {
              for (const node of mutation.addedNodes) {
                if (node.nodeType === 1 && (node.matches?.('.profile-answer') || node.querySelector?.('.profile-answer'))) {
                  window.__personaAnswers += 1;
                }
              }
            }
          }).observe(document.body, {subtree: true, childList: true});
        """)

        for question, required, forbidden in CASES:
            before = page.evaluate("window.__personaAnswers")
            page.fill("#profile-prompt", question)
            page.press("#profile-prompt", "Enter")
            page.wait_for_function(
                "before => window.__personaAnswers > before && !document.querySelector('.reasoner-activity')",
                arg=before,
                timeout=120_000,
            )
            answer = page.locator(".profile-answer > p").inner_text()
            lowered = answer.lower()
            missing = [value for value in required if value.lower() not in lowered]
            present = [value for value in forbidden if value.lower() in lowered]
            if missing or present or len(answer) >= 900 or any(dash in answer for dash in ("—", "–")):
                failures.append(
                    f"{question!r}: missing={missing}, forbidden={present}, answer={answer!r}"
                )

        browser.close()

    if failures:
        raise AssertionError("\n".join(failures))
    print(f"[persona-matrix] PASS: {len(CASES)}/{len(CASES)} browser-persona questions")


if __name__ == "__main__":
    main()
