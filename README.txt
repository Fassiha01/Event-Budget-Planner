╔══════════════════════════════════════════════════════════╗
║              EventBudget Pro — Local Setup               ║
╚══════════════════════════════════════════════════════════╝

REQUIREMENTS
  - Python 3.9 or newer  (https://www.python.org/downloads/)

QUICK START (Windows)
─────────────────────
1. Open a terminal (Command Prompt or PowerShell) in this folder
2. Install dependencies:
      pip install -r requirements.txt
3. Run the app:
      python app.py
4. Open your browser and visit:
      http://localhost:8000

QUICK START (macOS / Linux)
────────────────────────────
1. Open a terminal in this folder
2. Install dependencies:
      pip3 install -r requirements.txt
   (or use a virtual environment — see below)
3. Run the app:
      python3 app.py
4. Open your browser and visit:
      http://localhost:8000

OPTIONAL — Virtual Environment (recommended)
─────────────────────────────────────────────
  python -m venv venv
  source venv/bin/activate      # macOS/Linux
  venv\Scripts\activate.bat     # Windows
  pip install -r requirements.txt
  python app.py

DATA STORAGE
  All your events and settings are saved automatically in the
  "data/" folder as JSON files. They persist between restarts.

FILES
  app.py              ← Python Flask backend
  requirements.txt    ← Dependencies
  static/
    index.html        ← Single-page app
    style.css         ← Glassmorphism design
    app.js            ← Full frontend logic
  data/               ← Auto-created on first run
    events.json
    settings.json
