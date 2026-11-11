#!/usr/bin/env python3
"""
BLUNDERBOT: Premium Website & Game UI Rebuild
Browser Visual QA Evidence Generator
Captures real screenshots across required viewports:
- Desktop: 1920x1080
- Laptop: 1366x768
- Tablet: 768x1024
- Mobile: 390x844
"""

import os
import sys
import time
import json
import base64
import subprocess
import urllib.request

EVIDENCE_DIR = os.path.abspath(os.path.join(
    os.path.dirname(__file__),
    "../docs/ui-rebuild-evidence"
))
os.makedirs(EVIDENCE_DIR, exist_ok=True)

VIEWPORTS = [
    {
        "name": "desktop-1920x1080",
        "width": 1920,
        "height": 1080,
        "shots": ["home", "game-2d", "game-3d", "theme-studio", "game-result"]
    },
    {
        "name": "laptop-1366x768",
        "width": 1366,
        "height": 768,
        "shots": ["game-play"]
    },
    {
        "name": "tablet-768x1024",
        "width": 768,
        "height": 1024,
        "shots": ["game-play"]
    },
    {
        "name": "mobile-390x844",
        "width": 390,
        "height": 844,
        "shots": ["home", "game-play", "move-log"]
    }
]

def run():
    print("Launching geckodriver on port 4445...")
    driver = subprocess.Popen(["/snap/bin/geckodriver", "--port", "4445"])
    time.sleep(1.5)

    try:
        for vp in VIEWPORTS:
            w, h = vp["width"], vp["height"]
            print(f"\n==========================================")
            print(f"Testing Viewport: {vp['name']} ({w}x{h})")
            print(f"==========================================")

            # Create session with target viewport size
            req = urllib.request.Request(
                "http://localhost:4445/session",
                data=json.dumps({
                    "capabilities": {
                        "alwaysMatch": {
                            "moz:firefoxOptions": {
                                "args": ["-headless", f"--window-size={w},{h}"]
                            }
                        }
                    }
                }).encode(),
                headers={"Content-Type": "application/json"}
            )
            res = json.loads(urllib.request.urlopen(req).read().decode())
            session_id = res["value"]["sessionId"]
            print(f"Session created: {session_id}")

            def execute_script(script, args=None):
                req = urllib.request.Request(
                    f"http://localhost:4445/session/{session_id}/execute/sync",
                    data=json.dumps({"script": script, "args": args or []}).encode(),
                    headers={"Content-Type": "application/json"}
                )
                return json.loads(urllib.request.urlopen(req).read().decode())["value"]

            def take_screenshot(filename):
                req = urllib.request.Request(f"http://localhost:4445/session/{session_id}/screenshot")
                shot_b64 = json.loads(urllib.request.urlopen(req).read().decode())["value"]
                dest_path = os.path.join(EVIDENCE_DIR, filename)
                img_bytes = base64.b64decode(shot_b64)
                with open(dest_path, "wb") as f:
                    f.write(img_bytes)
                print(f"  ✓ Saved: {filename} ({len(img_bytes) // 1024} KB)")

            # Set viewport window rect
            req_rect = urllib.request.Request(
                f"http://localhost:4445/session/{session_id}/window/rect",
                data=json.dumps({"width": w, "height": h}).encode(),
                headers={"Content-Type": "application/json"}
            )
            try:
                urllib.request.urlopen(req_rect)
            except Exception as e:
                print(f"Window rect warning: {e}")

            # Capture shots for this viewport
            if "home" in vp["shots"]:
                print(f"Navigating to Home (http://localhost:3005/)...")
                req_url = urllib.request.Request(
                    f"http://localhost:4445/session/{session_id}/url",
                    data=json.dumps({"url": "http://localhost:3005/"}).encode(),
                    headers={"Content-Type": "application/json"}
                )
                urllib.request.urlopen(req_url)
                time.sleep(2.5)
                take_screenshot(f"{vp['name']}-home.png")

            if "game-2d" in vp["shots"]:
                print(f"Navigating to Game (2D Classical)...")
                req_url = urllib.request.Request(
                    f"http://localhost:4445/session/{session_id}/url",
                    data=json.dumps({"url": "http://localhost:3005/game?difficulty=hard&side=white"}).encode(),
                    headers={"Content-Type": "application/json"}
                )
                urllib.request.urlopen(req_url)
                time.sleep(3.0)
                # Ensure 2D perspective
                execute_script("""
                    const stored = localStorage.getItem('blunderbot_theme_v2');
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        parsed.perspective = 'flat-2d';
                        parsed.boardPresetId = 'royal-walnut';
                        parsed.pieceSetId = 'default';
                        localStorage.setItem('blunderbot_theme_v2', JSON.stringify(parsed));
                    }
                """)
                # Reload to pick up local storage
                urllib.request.urlopen(req_url)
                time.sleep(2.5)
                take_screenshot(f"{vp['name']}-game-2d.png")

            if "theme-studio" in vp["shots"]:
                print("Opening Theme Customizer Modal...")
                execute_script("""
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const themeBtn = buttons.find(b => b.textContent && (b.textContent.includes('Studio') || b.textContent.includes('Theme') || b.textContent.includes('Appearance')));
                    if (themeBtn) themeBtn.click();
                """)
                time.sleep(1.0)
                take_screenshot(f"{vp['name']}-theme-studio.png")
                # Close modal
                execute_script("""
                    const closeBtn = document.querySelector('button[aria-label=\"Close Customizer\"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Apply'));
                    if (closeBtn) closeBtn.click();
                """)
                time.sleep(0.5)

            if "game-result" in vp["shots"]:
                print("Capturing Game Result Modal...")
                execute_script("""
                    const resignBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Resign'));
                    if (resignBtn) resignBtn.click();
                """)
                time.sleep(1.5)
                take_screenshot(f"{vp['name']}-game-result.png")

            if "game-3d" in vp["shots"]:
                print("Switching to True 3D War Chess...")
                execute_script("""
                    const stored = localStorage.getItem('blunderbot_theme_v2');
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        parsed.perspective = 'true-3d';
                        parsed.boardPresetId = 'ancient-battlefield';
                        parsed.pieceSetId = 'astra-medieval';
                        localStorage.setItem('blunderbot_theme_v2', JSON.stringify(parsed));
                    }
                """)
                req_url = urllib.request.Request(
                    f"http://localhost:4445/session/{session_id}/url",
                    data=json.dumps({"url": "http://localhost:3005/game?difficulty=hard&side=white"}).encode(),
                    headers={"Content-Type": "application/json"}
                )
                urllib.request.urlopen(req_url)
                time.sleep(4.0)
                take_screenshot(f"{vp['name']}-game-3d.png")

            if "game-play" in vp["shots"]:
                print(f"Navigating to Game Play for {vp['name']}...")
                req_url = urllib.request.Request(
                    f"http://localhost:4445/session/{session_id}/url",
                    data=json.dumps({"url": "http://localhost:3005/game?difficulty=medium&side=white"}).encode(),
                    headers={"Content-Type": "application/json"}
                )
                urllib.request.urlopen(req_url)
                time.sleep(3.0)
                take_screenshot(f"{vp['name']}-game-play.png")

            if "move-log" in vp["shots"]:
                print("Opening Mobile Move History Drawer...")
                execute_script("""
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const logBtn = buttons.find(b => b.textContent && b.textContent.includes('Log'));
                    if (logBtn) logBtn.click();
                """)
                time.sleep(1.0)
                take_screenshot(f"{vp['name']}-move-log.png")

            # Clean session
            req_del = urllib.request.Request(f"http://localhost:4445/session/{session_id}", method="DELETE")
            try:
                urllib.request.urlopen(req_del)
            except Exception:
                pass

        print("\nAll UI rebuild evidence captures completed successfully!")

    finally:
        driver.terminate()

if __name__ == "__main__":
    run()
