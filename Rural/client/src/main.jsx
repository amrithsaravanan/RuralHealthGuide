import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import './causes.css';
import './professional.css';
import './conditions.css';
import './child-friendly.css';

// In production the frontend and API share the same origin. Vite's dev
// server proxy keeps the local development experience unchanged.
const API = import.meta.env.VITE_API_URL || '/api';
const disclaimer = 'This tool provides general information only and is not a substitute for professional medical diagnosis.';
const labels = {
  en: { title:'Rural Health Guide', subtitle:'Simple, practical health information', about:'About', back:'Back', start:'Choose who needs help', child:'Child', adult_male:'Adult male', adult_female:'Adult female', older_adult:'Older adult', symptoms:'What symptoms are present?', conditions:'Additional health information', pregnant:'Pregnant', chronic_illness:'Long-term condition', immunocompromised:'Weakened immune system', infant_under_3_months:'Infant under 3 months', continue:'Continue', duration:'How long?', severity:'How severe?', less:'Less than 1 day', '1to3':'1–3 days', '3plus':'More than 3 days', week:'More than 1 week', mild:'Mild', moderate:'Moderate', severe:'Severe', assess:'See guidance', read:'Read aloud', again:'Start again', warning:'Warning signs', facility:'Nearby care', loading:'Loading…', retry:'Try again', aboutTitle:'About Rural Health Guide' },
  hi: { title:'ग्रामीण स्वास्थ्य मार्गदर्शक', subtitle:'सरल स्वास्थ्य जानकारी', about:'जानकारी', back:'पीछे', start:'किसके लिए मदद चाहिए?', child:'बच्चा', adult_male:'वयस्क पुरुष', adult_female:'वयस्क महिला', older_adult:'बुज़ुर्ग', symptoms:'कौन से लक्षण हैं?', conditions:'अतिरिक्त स्वास्थ्य जानकारी', pregnant:'गर्भवती', chronic_illness:'लंबी बीमारी', immunocompromised:'कमज़ोर प्रतिरक्षा', infant_under_3_months:'3 महीने से कम शिशु', continue:'आगे', duration:'कितने समय से?', severity:'कितना गंभीर?', less:'1 दिन से कम', '1to3':'1–3 दिन', '3plus':'3 दिन से अधिक', week:'1 सप्ताह से अधिक', mild:'हल्का', moderate:'मध्यम', severe:'गंभीर', assess:'सलाह देखें', read:'जोर से पढ़ें', again:'फिर शुरू करें', warning:'चेतावनी संकेत', facility:'नज़दीकी स्वास्थ्य केंद्र', loading:'लोड हो रहा है…', retry:'फिर कोशिश करें', aboutTitle:'ग्रामीण स्वास्थ्य मार्गदर्शक के बारे में' }
};
const modelSymptoms = ['polyuria','polydipsia','sudden_weight_loss','weakness','polyphagia','genital_thrush','visual_blurring','itching','irritability','delayed_healing','partial_paresis','muscle_stiffness','alopecia','obesity'];

function About({ t, onBack }) {
  return <section className="card about">
    <button className="text-button" onClick={onBack}>{t.back}</button>
    <h2>{t.aboutTitle}</h2>
    <p>Rural Health Guide is a low-bandwidth, structured symptom guidance tool for children, adults, and older adults. It helps people choose what to do next; it does not diagnose disease or replace a health professional.</p>
    <h3>How guidance is produced</h3>
    <ol><li>Hard-coded red-flag rules are checked first.</li><li>Seeded rules then use the selected symptom, duration, severity, and user mode.</li><li>A Python MLP may provide an additional diabetes-risk screening signal when trained; it can never change emergency guidance.</li></ol>
    <h3>What the current dataset covers</h3>
    <p>The optional UCI Early Stage Diabetes Risk Prediction dataset supports one classification task: diabetes risk screening, with positive/negative labels. It is not a general disease dataset and must not be described as covering heart disease, cancer, infection, or other conditions.</p>
    <p>Its questionnaire features include frequent urination, excessive thirst, sudden weight loss, weakness, increased hunger, genital thrush, blurred vision, itching, irritability, slow healing, partial weakness, muscle stiffness, hair loss, and obesity. The app’s broader symptom list is rule-based starter content, not learned from that dataset.</p>
    <h3>Important limits</h3>
    <ul><li>Starter medical content requires review by a qualified clinician before deployment.</li><li>Dataset performance may not generalize to rural populations, children, or other regions.</li><li>The included symptom–disease file is used only to rank possible causes; it cannot establish a diagnosis.</li></ul>
    <p className="source-note">Dataset source: UCI Machine Learning Repository, CC BY 4.0. Review the source documentation and license before using it in production.</p>
  </section>;
}

function App() {
  const [lang, setLang] = useState(localStorage.lang || 'en');
  const [view, setView] = useState('flow');
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState('');
  const [all, setAll] = useState([]);
  const [chosen, setChosen] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const t = labels[lang] || labels.en;

  useEffect(() => { localStorage.lang = lang; if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js'); }, [lang]);
  useEffect(() => { if (!mode) return; setLoading(true); setError(''); fetch(`${API}/symptoms?modeId=${encodeURIComponent(mode)}`).then(r => { if (!r.ok) throw new Error('Could not load symptoms'); return r.json(); }).then(setAll).catch(() => setError('Could not load symptoms. Check that the API is running.')).finally(() => setLoading(false)); }, [mode]);
  const toggle = id => setChosen(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  const updateAnswer = (id, field, value) => setAnswers(current => ({ ...current, [id]: { ...(current[id] || {}), [field]: value } }));
  const assess = async () => { setLoading(true); setError(''); try { const symptoms = chosen.map(id => ({ symptomId:id, duration:answers[id]?.duration || '1to3', severity:answers[id]?.severity || 'mild' })); const response = await fetch(`${API}/assess-symptoms`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ modeId:mode, symptoms, conditions }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Assessment failed'); setResult(body); setStep(3); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  const toggleCondition = id => setConditions(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  const restart = () => { setView('flow'); setStep(0); setMode(''); setChosen([]); setConditions([]); setAnswers({}); setResult(null); setError(''); };
  const speak = () => { if (result && 'speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(`${result.guidance.title}. ${result.guidance.steps.join('. ')} Warning signs: ${result.warningSigns.join('. ')}`)); };

  return <div className="app"><header><div><h1>{t.title}</h1><p>{t.subtitle}</p></div><div className="header-actions"><button className="text-button" onClick={() => setView(view === 'about' ? 'flow' : 'about')}>{view === 'about' ? t.back : t.about}</button><select value={lang} onChange={e => setLang(e.target.value)}><option value="en">English</option><option value="hi">हिन्दी</option><option value="regional">Regional language</option></select></div></header><main>
    {view === 'about' ? <About t={t} onBack={() => setView('flow')} /> : <>
      {error && <div className="error" role="alert">{error} <button onClick={() => setError('')}>×</button></div>}
      {step === 0 && <section className="card"><h2>{t.start}</h2><div className="grid">{['child','adult_male','adult_female','older_adult'].map(x => <button className="choice" onClick={() => { setMode(x); setStep(1); }} key={x}><span>{t[x]}</span><small>Continue</small></button>)}</div></section>}
      {step === 1 && <section className="card"><h2>{t.symptoms}</h2>{loading ? <p>{t.loading}</p> : <><button className="voice" onClick={() => { const Speech = window.SpeechRecognition || window.webkitSpeechRecognition; if (!Speech) return setError('Voice input is not supported in this browser.'); const recognition = new Speech(); recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'; recognition.onresult = e => { const text = e.results[0][0].transcript.toLowerCase(); const hit = all.find(s => text.includes(s.name.toLowerCase())); if (hit) toggle(hit.id); else setError('No matching structured symptom was found.'); }; recognition.start(); }}>Use voice input</button><div className="symptoms">{all.map(s => <button className={chosen.includes(s.id) ? 'symptom selected' : 'symptom'} onClick={() => toggle(s.id)} key={s.id}><span className="symptom-marker" aria-hidden="true" />{s.name}<small>{s.category}</small></button>)}</div></>}<div className="actions"><button onClick={restart}>{t.back}</button><button className="primary" disabled={!chosen.length || loading} onClick={() => setStep(2)}>{t.continue}</button></div></section>}
      {step === 2 && <section className="card"><h2>{t.symptoms}</h2>{chosen.map(id => { const symptom = all.find(x => x.id === id); const answer = answers[id] || {}; return <div className="question" key={id}><h3>{symptom?.name}</h3><strong>{t.duration}</strong><div className="pills">{[['less','less'],['1to3','1to3'],['3plus','3plus'],['week','week']].map(([value,key]) => <button key={value} className={answer.duration === value ? 'active' : ''} onClick={() => updateAnswer(id,'duration',value)}>{t[key]}</button>)}</div><strong>{t.severity}</strong><div className="pills">{['mild','moderate','severe'].map(value => <button key={value} className={answer.severity === value ? `active ${value}` : ''} onClick={() => updateAnswer(id,'severity',value)}>{t[value]}</button>)}</div></div>; })}<div className="condition-panel"><h3>{t.conditions}</h3>{['pregnant','chronic_illness','immunocompromised','infant_under_3_months'].map(id => <label className="condition"><input type="checkbox" checked={conditions.includes(id)} onChange={() => toggleCondition(id)} />{t[id]}</label>)}</div><div className="actions"><button onClick={() => setStep(1)}>{t.back}</button><button className="primary" disabled={loading} onClick={assess}>{loading ? t.loading : t.assess}</button></div></section>}
      {step === 3 && result && <section className={`result ${result.redFlagTriggered ? 'emergency' : result.outcomeCategory === 'seek_soon' ? 'soon' : 'safe'}`}><div className="card"><div className="badge">{result.redFlagTriggered ? 'URGENT' : result.outcomeCategory === 'seek_soon' ? 'SEEK CARE SOON' : 'SELF-CARE / MONITOR'}</div><h2>{result.guidance.title}</h2>{result.redFlagReasons?.length > 0 && <div className="reasons">{result.redFlagReasons.map(x => <p key={x}>{x}</p>)}</div>}<ul>{result.guidance.steps.map(x => <li key={x}>{x}</li>)}</ul><h3>{t.warning}</h3><ul>{result.warningSigns.map(x => <li key={x}>{x}</li>)}</ul>{result.possibleCauses?.length > 0 && <div className="possible-causes"><h3>Possible causes to discuss with a clinician</h3><ul>{result.possibleCauses.map(item => <li key={item.disease}>{item.disease}</li>)}</ul><p>These are dataset-based possibilities, not a diagnosis. A qualified health professional should assess you.</p></div>}{result.modelSignal && <p className="model-note">An auxiliary screening signal is available for clinician review. It is not a diagnosis and does not change this guidance.</p>}<button className="primary" onClick={speak}>Read guidance aloud</button></div><div className="card"><h3>{t.facility}</h3><p>Nearest Primary Health Centre · Sample rural health facility</p><p>Use local emergency services immediately if you feel unsafe.</p></div><button className="restart" onClick={restart}>{t.again}</button></section>}
    </>}
    <div className="disclaimer" role="note">Important: {disclaimer}</div>
  </main></div>;
}
createRoot(document.getElementById('root')).render(<App />);
