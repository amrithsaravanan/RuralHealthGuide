import { readFileSync, existsSync } from 'node:fs';

const source = './server/data/symptom-disease.csv';
const aliases = {
  fever: ['fever', 'high_fever'], cough: ['cough'], difficulty_breathing: ['breathlessness'], chest_pain: ['chest_pain'],
  headache: ['headache'], stomach_pain: ['stomach_pain', 'abdominal_pain'], diarrhea: ['diarrhoea', 'diarrhea'], vomiting: ['vomiting'],
  rash: ['skin_rash'], sore_throat: ['patches_in_throat'], back_pain: ['back_pain'], tooth_pain: ['toothache'], urinary_pain: ['burning_micturition'],
  dizziness: ['dizziness'], polyuria: ['polyuria'], polydipsia: ['excessive_thirst'], sudden_weight_loss: ['weight_loss'], weakness: ['weakness'],
  polyphagia: ['excessive_hunger', 'increased_appetite'], visual_blurring: ['blurred_and_distorted_vision'], itching: ['itching'], obesity: ['obesity']
};

function clean(value) { return String(value || '').trim().toLowerCase().replace(/\s+/g, '_'); }
function parse() {
  if (!existsSync(source)) return [];
  return readFileSync(source, 'utf8').split(/\r?\n/).slice(1).map(line => line.split(',').map(clean)).filter(row => row.length > 1 && row[0]).map(row => ({ disease: row[0].replace(/_/g, ' '), symptoms: new Set(row.slice(1).filter(Boolean)) }));
}
const records = parse();
export function possibleCauses(symptomIds) {
  const requested = new Set(symptomIds.flatMap(id => aliases[id] || []));
  if (!requested.size) return [];
  const scores = new Map();
  for (const record of records) { const matches = [...record.symptoms].filter(s => requested.has(s)).length; if (matches) scores.set(record.disease, Math.max(scores.get(record.disease) || 0, matches)); }
  return [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([disease, matchedSymptoms]) => ({ disease, matchedSymptoms }));
}
