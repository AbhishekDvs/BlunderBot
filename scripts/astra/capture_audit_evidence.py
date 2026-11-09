#!/usr/bin/env python3
"""
Astra War Chess 3D Browser Evidence Capture
Authoritative specification: docs/astra/ANIMATION.md, AUDIT.md

Automates genuine headless browser sessions to capture production visual evidence:
1. 3d-tactical-view.png (Full 8x8 physical board in tactical elevated camera)
2. 3d-cinematic-view.png (Low-angle dramatic cinematic camera)
3. 3d-white-full-army.png (White sculpted miniatures at true scale)
4. 3d-black-full-army.png (Black basalt & bronze miniatures with lifted fill lighting)
5. 3d-knight-bishop-duel.png (Knight vs Bishop synchronized contact capture)
"""

import os
import sys
import time
import json
import base64
import subprocess
import urllib.request

RECOVERY_DIR = os.path.abspath(os.path.join(
    os.path.dirname(__file__),
    "../../docs/astra/recovery"
))
os.makedirs(RECOVERY_DIR, exist_ok=True)

HOME_DIR = os.path.expanduser("~")

def run():
    print("Launching geckodriver on port 4444...")
    driver = subprocess.Popen(["/snap/bin/geckodriver", "--port", "4444"])
    time.sleep(1.2)

    try:
        # 1. Create browser session with 1280x900 viewport
        req = urllib.request.Request(
            "http://localhost:4444/session",
            data=json.dumps({
                "capabilities": {
                    "alwaysMatch": {
                        "moz:firefoxOptions": {
                            "args": ["-headless", "--window-size=1280,900"]
                        }
                    }
                }
            }).encode(),
            headers={"Content-Type": "application/json"}
        )
        res = json.loads(urllib.request.urlopen(req).read().decode())
        session_id = res["value"]["sessionId"]
        print(f"WebDriver Session created: {session_id}")

        def execute_script(script, args=None):
            req = urllib.request.Request(
                f"http://localhost:4444/session/{session_id}/execute/sync",
                data=json.dumps({"script": script, "args": args or []}).encode(),
                headers={"Content-Type": "application/json"}
            )
            return json.loads(urllib.request.urlopen(req).read().decode())["value"]

        def take_screenshot(filename):
            req = urllib.request.Request(f"http://localhost:4444/session/{session_id}/screenshot")
            shot_b64 = json.loads(urllib.request.urlopen(req).read().decode())["value"]
            dest_path = os.path.join(RECOVERY_DIR, filename)
            with open(dest_path, "wb") as f:
                f.write(base64.b64decode(shot_b64))
            print(f"  ✓ Saved evidence: {filename} ({os.path.getsize(dest_path) // 1024} KB)")

        # 2. Navigate to application
        print("Navigating to http://localhost:3005/game...")
        req = urllib.request.Request(
            f"http://localhost:4444/session/{session_id}/url",
            data=json.dumps({"url": "http://localhost:3005/game"}).encode(),
            headers={"Content-Type": "application/json"}
        )
        urllib.request.urlopen(req)

        # Allow full asset preloading and board upgrade
        print("Waiting 4.5s for 3D GLB army models and renderer initialization...")
        time.sleep(4.5)

        # Check renderer readiness
        is_ready = execute_script("""
            return !!(window.__THREE_RENDERER__ && window.__GLB_CACHE__ && window.__GLB_CACHE__.size > 0);
        """)
        print(f"3D Renderer & GLB Cache initialized: {is_ready}")

        # 3. Capture Tactical View
        print("Capturing 3d-tactical-view.png...")
        execute_script("""
            if (window.__THREE_RENDERER__) {
                window.__THREE_RENDERER__.setCameraMode('tactical');
            }
        """)
        time.sleep(1.0)
        take_screenshot("3d-tactical-view.png")

        # 4. Capture Cinematic View
        print("Capturing 3d-cinematic-view.png...")
        execute_script("""
            if (window.__THREE_RENDERER__) {
                window.__THREE_RENDERER__.setCameraMode('cinematic');
            }
        """)
        time.sleep(1.2)
        take_screenshot("3d-cinematic-view.png")

        # 5. Capture White Army Focused View
        print("Capturing 3d-white-full-army.png...")
        execute_script("""
            if (window.__THREE_RENDERER__) {
                window.__THREE_RENDERER__.setCameraMode('tactical');
                window.__THREE_RENDERER__.cameraCtrl.setOrientation('white');
            }
        """)
        time.sleep(0.8)
        take_screenshot("3d-white-full-army.png")

        # 6. Capture Black Army Focused View (Orientation flipped to showcase dark basalt & bronze)
        print("Capturing 3d-black-full-army.png...")
        execute_script("""
            if (window.__THREE_RENDERER__) {
                window.__THREE_RENDERER__.setOrientation('black');
            }
        """)
        time.sleep(1.2)
        take_screenshot("3d-black-full-army.png")

        # 7. Reset to White orientation and trigger Knight vs Bishop Capture Encounter
        print("Triggering Knight vs Bishop encounter for 3d-knight-bishop-duel.png...")
        execute_script("""
            if (window.__THREE_RENDERER__) {
                window.__THREE_RENDERER__.setOrientation('white');
                window.__THREE_RENDERER__.setCameraMode('cinematic');
            }
        """)
        time.sleep(0.8)

        # Move white knight to d4 and black bishop to e5, then trigger capture
        execute_script("""
            if (window.__THREE_RENDERER__) {
                // Set FEN with Knight and Bishop adjacent in center
                window.__THREE_RENDERER__.setFen('rnbqk1nr/pppp1ppp/8/4b3/3N4/8/PPPPPPPP/RNBQKB1R w KQkq - 0 1');
            }
        """)
        time.sleep(0.8)

        # Trigger capture encounter: wN at d4 captures bB at e5
        execute_script("""
            if (window.__THREE_RENDERER__) {
                window.__THREE_RENDERER__.triggerCapture('d4', 'e5', 'wN', 'bB');
            }
        """)

        # Wait ~1050ms so encounter is exactly in impact / spark phase (progress = 0.54 of 1900ms = 1026ms)
        time.sleep(1.05)
        take_screenshot("3d-knight-bishop-duel.png")

        print("\nAll browser evidence successfully captured and saved to docs/astra/recovery/")

        # Clean session
        req = urllib.request.Request(f"http://localhost:4444/session/{session_id}", method="DELETE")
        urllib.request.urlopen(req)

    finally:
        driver.terminate()

if __name__ == "__main__":
    run()
