# QuizCove
QuizCove is a free, static study site based on the Swedish education system.
It has no account or sign-in features; study progress and study plans stay in
the browser and can be exported to or imported from a save file.

## Run locally

Serve the repository root with a local static server, for example:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`. The app needs no hosted backend; the local
server is only needed because the save-file interface uses JavaScript modules.
Study progress, self-assessments, and study plans are stored in the browser.
The study planner lets you create exam plans, add timed tasks and deadlines,
track completed tasks, and see an exam countdown. Use **Exportera sparfil** and
**Importera sparfil** to back up or move your data between browsers without
signing in. Existing version-one save files remain importable.

## Publish with GitHub Pages

The GitHub Actions workflow in `.github/workflows/static.yml` deploys the
static site from the repository root to GitHub Pages. Enable GitHub Pages for
the repository and select **GitHub Actions** as the build and deployment
source. Pushes to `main` then publish automatically.
