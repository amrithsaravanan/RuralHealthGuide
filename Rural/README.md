# Rural Health Guide

Rule-based symptom guidance for rural and low-bandwidth users. This is an informational decision-support tool, not a diagnostic system.

## Run
1. `npm install`
2. `npm run seed`
3. `npm run dev` (API on `:4000`, client on `:5173`)

## Deploy to Vercel

The repository is configured as a single Vercel project: the Vite app is built
from `client/`, while `/api/*` is served by the Express handler in `api/`.
Import the repository into Vercel with the project root left at the repository
root, deploy, and then add `ruralhealthguide.amrith.engineer` under the
project's Domains settings. Point the domain's DNS at the records Vercel
provides (usually a CNAME for `www` and an A record for the apex domain).

Vercel requires Node 22 or newer because the API uses Node's built-in SQLite
support. The checked-in SQLite database is used at deploy time; no seed step is
needed for Vercel deployments. Set `DATABASE_FILE` only if you provide a
different database path in the deployment environment.

The client is a Vite PWA with a service worker and cached starter guidance. Medical content must be reviewed by a qualified professional before real-world deployment.

The in-app About page explains the architecture and scope. The diabetes MLP dataset is only for early-stage diabetes-risk classification. A separate public symptom–disease CSV is used only to rank possible causes for discussion; it is not a clinical ground-truth model and does not control urgency. The general symptom guidance remains explicit rule-based starter content.

## Optional Python MLP layer
Install Python dependencies with `pip install -r server/requirements.txt`, then train the scikit-learn MLP with `python server/src/ml_service.py train`. The Node API calls it for an auxiliary signal. Its output is non-diagnostic; red flags and care urgency always come from the explicit rule engine.

Dataset source: https://archive.ics.uci.edu/dataset/529/early+stage+diabetes+risk+prediction+dataset. The training command downloads it only when an operator explicitly runs the command; the app itself does not silently download datasets.

Possible-cause source: the downloaded `server/data/symptom-disease.csv` from the public [Disease-Symptom-Dataset repository](https://github.com/hemasriram111/Disease-Symptom-Dataset). Review provenance and licensing before production use.

## Structure
`client/` contains the accessible React flow. `server/src/` contains the SQLite schema, explicit seed rules, decision engine, and API. Emergency red flags are evaluated before ordinary rules.
