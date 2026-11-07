import express from 'express';
import cors from 'cors';
import { spawnSync } from 'node:child_process';
import db from './db.js';
import { possibleCauses } from './knowledge.js';

const app = express();
const port = Number(process.env.PORT || 4000);
app.use(cors());
app.use(express.json({ limit: '32kb' }));
const allowedModes = new Set(db.prepare('SELECT id FROM modes').all().map(x => x.id));
const allowedDurations = new Set(['less', '1to3', '3plus', 'week']);
const allowedSeverities = new Set(['mild', 'moderate', 'severe']);
const allowedConditions = new Set(['pregnant', 'chronic_illness', 'immunocompromised', 'infant_under_3_months']);
const normalize = value => String(value || '').trim().toLowerCase();
const fail = (res, message) => res.status(400).json({ error: message });

function getModelSignal(features) {
  const result = spawnSync(process.env.PYTHON_BIN || 'python', ['server/src/ml_service.py', 'predict'], { input: JSON.stringify({ features }), encoding: 'utf8', timeout: 2500 });
  if (result.error || result.status !== 0) return null;
  try { const parsed = JSON.parse(result.stdout); return parsed.available ? parsed : null; } catch { return null; }
}

app.get('/api/modes', (_, res) => res.json(db.prepare('SELECT * FROM modes').all()));
app.get('/api/symptoms', (req, res) => {
  const modeId = normalize(req.query.modeId);
  if (!allowedModes.has(modeId)) return fail(res, 'A valid modeId is required.');
  res.json(db.prepare('SELECT id,name,category,mode_ids FROM symptoms').all().filter(row => JSON.parse(row.mode_ids).includes(modeId)).map(({ mode_ids, ...row }) => row));
});

app.post('/api/assess-symptoms', (req, res) => {
  const { modeId, symptoms, conditions = [] } = req.body || {};
  if (!allowedModes.has(modeId) || !Array.isArray(symptoms) || symptoms.length < 1 || symptoms.length > 12) return fail(res, 'Choose a valid mode and between 1 and 12 symptoms.');
  if (!Array.isArray(conditions) || conditions.some(condition => !allowedConditions.has(condition))) return fail(res, 'Conditions must be a valid list.');
  const known = new Set(db.prepare('SELECT id FROM symptoms').all().map(x => x.id));
  const inputs = symptoms.map(s => ({ symptomId: normalize(s.symptomId), duration: normalize(s.duration), severity: normalize(s.severity) }));
  if (inputs.some(s => !known.has(s.symptomId) || !allowedDurations.has(s.duration) || !allowedSeverities.has(s.severity))) return fail(res, 'Each symptom must include a valid duration and severity.');

  const redReasons = [];
  for (const symptom of inputs) {
    const rows = db.prepare("SELECT description FROM red_flags WHERE symptom_id=? AND (mode_id=? OR mode_id='*')").all(symptom.symptomId, modeId);
    if (rows.length && (symptom.symptomId !== 'fever' || symptom.severity === 'severe')) redReasons.push(...rows.map(x => x.description));
  }
  if (conditions.includes('infant_under_3_months') && inputs.some(s => s.symptomId === 'fever')) redReasons.push('Fever in an infant under 3 months requires immediate medical assessment.');
  let outcomeCategory = redReasons.length ? 'seek_immediately' : 'self_care';
  let guidanceId = redReasons.length ? 'immediate' : 'self';
  if (!redReasons.length && inputs.some(symptom => symptom.severity === 'severe')) { outcomeCategory = 'seek_soon'; guidanceId = 'soon'; }
  else if (!redReasons.length) for (const symptom of inputs) {
    const rule = db.prepare("SELECT outcome_category,guidance_id FROM rules WHERE symptom_id=? AND mode_id=? AND (duration_range='any' OR duration_range=?) AND (severity_level='mild_or_moderate' OR severity_level=?) ORDER BY CASE outcome_category WHEN 'seek_soon' THEN 1 ELSE 2 END LIMIT 1").get(symptom.symptomId, modeId, symptom.duration, symptom.severity);
    if (rule && (rule.outcome_category === 'seek_soon' || outcomeCategory === 'self_care')) { outcomeCategory = rule.outcome_category; guidanceId = rule.guidance_id; }
  }
  if (!redReasons.length && (conditions.includes('pregnant') || conditions.includes('immunocompromised') || conditions.includes('chronic_illness')) && inputs.some(s => ['fever','vomiting','diarrhea'].includes(s.symptomId))) { outcomeCategory = 'seek_soon'; guidanceId = 'soon'; }
  const guidance = db.prepare('SELECT title,self_care_steps,warning_signs FROM guidance WHERE id=?').get(guidanceId);
  const names = ['polyuria','polydipsia','sudden_weight_loss','weakness','polyphagia','genital_thrush','visual_blurring','itching','irritability','delayed_healing','partial_paresis','muscle_stiffness','alopecia','obesity'];
  const features = Object.fromEntries(names.map(name => [name, inputs.some(s => s.symptomId === name) ? 1 : 0]));
  const modelSignal = getModelSignal(features);
  res.json({ outcomeCategory, guidance: { title: guidance.title, steps: JSON.parse(guidance.self_care_steps) }, warningSigns: JSON.parse(guidance.warning_signs), redFlagTriggered: redReasons.length > 0, redFlagReasons: redReasons, possibleCauses: redReasons.length ? [] : possibleCauses(inputs.map(s => s.symptomId)), modelSignal: modelSignal ? { type: 'auxiliary_diabetes_risk_signal', score: modelSignal.score, warning: modelSignal.warning } : null });
});

app.get('/api/facilities/nearby', (_, res) => res.json([{ name: 'Nearest Primary Health Centre', type: 'Primary Health Centre', address: 'Sample rural health facility', phone: 'Local health number', lat: 12.9716, lng: 77.5946, mapUrl: 'https://maps.google.com/?q=12.9716,77.5946' }]));
app.get('/api/guidance/:id', (req, res) => { const g = db.prepare('SELECT * FROM guidance WHERE id=?').get(req.params.id); if (!g) return res.status(404).json({ error: 'Guidance not found.' }); res.json({ ...g, self_care_steps: JSON.parse(g.self_care_steps), warning_signs: JSON.parse(g.warning_signs) }); });
app.use((err, _, res, __) => { if (err instanceof SyntaxError && err.status === 400 && 'body' in err) return res.status(400).json({ error: 'Request body must be valid JSON.' }); res.status(500).json({ error: 'Unexpected server error.' }); });
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
