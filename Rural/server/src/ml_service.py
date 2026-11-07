import json, sys, urllib.request, zipfile, io
from pathlib import Path

import joblib
import pandas as pd
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
MODEL = DATA / "diabetes_mlp.joblib"
URL = "https://archive.ics.uci.edu/static/public/529/early+stage+diabetes+risk+prediction+dataset.zip"

FEATURES = ["Polyuria", "Polydipsia", "sudden weight loss", "weakness", "Polyphagia",
            "Genital thrush", "visual blurring", "Itching", "Irritability",
            "delayed healing", "partial paresis", "muscle stiffness", "Alopecia", "Obesity"]

def encode(value):
    return 1 if str(value).strip().lower() in {"yes", "positive", "male", "1"} else 0

def normalize(name):
    return " ".join(str(name).replace("_", " ").lower().split())

def train():
    DATA.mkdir(exist_ok=True)
    raw = urllib.request.urlopen(URL, timeout=30).read()
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        name = next(n for n in archive.namelist() if n.lower().endswith(".csv"))
        with archive.open(name) as stream:
            frame = pd.read_csv(stream)
    frame.columns = [str(c).strip() for c in frame.columns]
    available = [c for c in FEATURES if c in frame.columns]
    X = frame[available].map(encode)
    y = frame["class"].map(lambda x: 1 if str(x).strip().lower() == "positive" else 0)
    model = Pipeline([("scale", StandardScaler()), ("mlp", MLPClassifier(hidden_layer_sizes=(16, 8), max_iter=500, random_state=42))])
    model.fit(X, y)
    joblib.dump({"model": model, "features": available}, MODEL)
    print(json.dumps({"trained": True, "rows": len(frame), "features": available}))

def predict():
    if not MODEL.exists():
        print(json.dumps({"available": False}))
        return
    payload = json.loads(sys.stdin.read())
    saved = joblib.load(MODEL)
    values = payload.get("features", {})
    normalized = {normalize(k): v for k, v in values.items()}
    vector = [[int(normalized.get(normalize(name), 0)) for name in saved["features"]]]
    score = float(saved["model"].predict_proba(vector)[0][1])
    print(json.dumps({"available": True, "score": round(score, 3), "warning": "Auxiliary signal only; not a diagnosis and never used for emergency triage."}))

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "train": train()
    elif len(sys.argv) > 1 and sys.argv[1] == "predict": predict()
    else: raise SystemExit("Use: python server/src/ml_service.py train|predict")
