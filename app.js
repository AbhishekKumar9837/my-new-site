/**
 * LinguaFlow — app.js
 * Multi-API Language Translation Tool
 * APIs (tried in order, automatic fallback):
 *   1. Google Translate (gtx)  — unofficial endpoint, no key, handles any length
 *   2. MyMemory                — translation memory, no key, chunked for long text
 *   3. Lingva Translate        — Google mirror, tries multiple public instances
 * Features: translate, auto-detect, swap, copy, TTS, history, dark/light mode
 */

'use strict';

/* ============================================================
   CONSTANTS & DATA
   ============================================================ */

const MAX_CHARS   = 5000;
const MAX_HISTORY = 10;

/**
 * API providers tried in order — first success wins.
 * name  : display label shown in UI
 * call  : async function(text, src, tgt) → { success, translatedText, detectedLang, error }
 */
const API_PROVIDERS = [
  { name: 'Google',   call: translateWithGoogle },
  { name: 'MyMemory', call: translateWithMyMemory },
  { name: 'Lingva',   call: translateWithLingva },
];

/** Supported languages (code → display name) */
const LANGUAGES = {
  af: 'Afrikaans',
  sq: 'Albanian',
  am: 'Amharic',
  ar: 'Arabic',
  hy: 'Armenian',
  az: 'Azerbaijani',
  eu: 'Basque',
  be: 'Belarusian',
  bn: 'Bengali',
  bs: 'Bosnian',
  bg: 'Bulgarian',
  ca: 'Catalan',
  zh: 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  hr: 'Croatian',
  cs: 'Czech',
  da: 'Danish',
  nl: 'Dutch',
  en: 'English',
  eo: 'Esperanto',
  et: 'Estonian',
  fi: 'Finnish',
  fr: 'French',
  gl: 'Galician',
  ka: 'Georgian',
  de: 'German',
  el: 'Greek',
  gu: 'Gujarati',
  ht: 'Haitian Creole',
  ha: 'Hausa',
  he: 'Hebrew',
  hi: 'Hindi',
  hu: 'Hungarian',
  is: 'Icelandic',
  ig: 'Igbo',
  id: 'Indonesian',
  ga: 'Irish',
  it: 'Italian',
  ja: 'Japanese',
  kn: 'Kannada',
  kk: 'Kazakh',
  km: 'Khmer',
  ko: 'Korean',
  ku: 'Kurdish',
  ky: 'Kyrgyz',
  lo: 'Lao',
  lv: 'Latvian',
  lt: 'Lithuanian',
  lb: 'Luxembourgish',
  mk: 'Macedonian',
  mg: 'Malagasy',
  ms: 'Malay',
  ml: 'Malayalam',
  mt: 'Maltese',
  mi: 'Maori',
  mr: 'Marathi',
  mn: 'Mongolian',
  my: 'Myanmar (Burmese)',
  ne: 'Nepali',
  no: 'Norwegian',
  ny: 'Nyanja (Chichewa)',
  or: 'Odia (Oriya)',
  ps: 'Pashto',
  fa: 'Persian',
  pl: 'Polish',
  pt: 'Portuguese',
  pa: 'Punjabi',
  ro: 'Romanian',
  ru: 'Russian',
  sm: 'Samoan',
  gd: 'Scots Gaelic',
  sr: 'Serbian',
  st: 'Sesotho',
  sn: 'Shona',
  sd: 'Sindhi',
  si: 'Sinhala',
  sk: 'Slovak',
  sl: 'Slovenian',
  so: 'Somali',
  es: 'Spanish',
  su: 'Sundanese',
  sw: 'Swahili',
  sv: 'Swedish',
  tl: 'Tagalog (Filipino)',
  tg: 'Tajik',
  ta: 'Tamil',
  tt: 'Tatar',
  te: 'Telugu',
  th: 'Thai',
  tr: 'Turkish',
  tk: 'Turkmen',
  uk: 'Ukrainian',
  ur: 'Urdu',
  ug: 'Uyghur',
  uz: 'Uzbek',
  vi: 'Vietnamese',
  cy: 'Welsh',
  xh: 'Xhosa',
  yi: 'Yiddish',
  yo: 'Yoruba',
  zu: 'Zulu',
};

/* ============================================================
   DOM ELEMENT REFERENCES
   ============================================================ */

const $ = id => document.getElementById(id);

const dom = {
  sourceLang:        $('sourceLang'),
  targetLang:        $('targetLang'),
  inputText:         $('inputText'),
  outputText:        $('outputText'),
  translateBtn:      $('translateBtn'),
  clearBtn:          $('clearBtn'),
  swapBtn:           $('swapBtn'),
  copyBtn:           $('copyBtn'),
  speakBtn:          $('speakBtn'),
  themeToggle:       $('themeToggle'),
  moonIcon:          $('moonIcon'),
  sunIcon:           $('sunIcon'),
  charCounter:       $('charCounter'),
  detectedBadge:     $('detectedLangBadge'),
  detectedLangName:  $('detectedLangName'),
  loadingSpinner:    $('loadingSpinner'),
  historyList:       $('historyList'),
  clearHistoryBtn:   $('clearHistoryBtn'),
  toast:             $('toast'),
};

/* ============================================================
   STATE
   ============================================================ */

const state = {
  translatedText:  '',
  isSpeaking:      false,
  isTranslating:   false,
  currentTheme:    'dark',
  history:         [],
  toastTimer:      null,
  speechSynthesis: window.speechSynthesis || null,
  currentUtterance: null,
};

/* ============================================================
   INITIALIZATION
   ============================================================ */

function init() {
  populateLanguageDropdowns();
  loadThemeFromStorage();
  loadHistoryFromStorage();
  attachEventListeners();
  updateCharCounter();
}

/** Fill both dropdowns with sorted language options */
function populateLanguageDropdowns() {
  const sortedLangs = Object.entries(LANGUAGES).sort((a, b) =>
    a[1].localeCompare(b[1])
  );

  // Source: prepend "Auto Detect" (already in HTML), then all langs
  sortedLangs.forEach(([code, name]) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = name;
    dom.sourceLang.appendChild(opt);
  });

  // Target: all langs (no auto detect)
  sortedLangs.forEach(([code, name]) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = name;
    dom.targetLang.appendChild(opt);
  });

  // Defaults: source = auto, target = French
  dom.sourceLang.value = 'auto';
  dom.targetLang.value = 'fr';
}

/* ============================================================
   EVENT LISTENERS
   ============================================================ */

function attachEventListeners() {
  dom.translateBtn.addEventListener('click',        handleTranslate);
  dom.clearBtn.addEventListener('click',            handleClear);
  dom.swapBtn.addEventListener('click',             handleSwap);
  dom.copyBtn.addEventListener('click',             handleCopy);
  dom.speakBtn.addEventListener('click',            handleSpeak);
  dom.themeToggle.addEventListener('click',         handleThemeToggle);
  dom.clearHistoryBtn.addEventListener('click',     handleClearHistory);

  // Character counter on input
  dom.inputText.addEventListener('input', updateCharCounter);

  // Translate on Ctrl+Enter / Cmd+Enter
  dom.inputText.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleTranslate();
    }
  });
}

/* ============================================================
   TRANSLATION
   ============================================================ */

async function handleTranslate() {
  const text = dom.inputText.value.trim();

  // Validate input
  if (!text) {
    showToast('Please enter some text to translate.', 'error');
    dom.inputText.focus();
    return;
  }

  if (state.isTranslating) return;

  const sourceLang = dom.sourceLang.value;
  const targetLang = dom.targetLang.value;

  if (sourceLang !== 'auto' && sourceLang === targetLang) {
    showToast('Source and target languages are the same!', 'error');
    return;
  }

  setTranslatingState(true);
  clearOutput();

  try {
    const result = await translateText(text, sourceLang, targetLang);

    if (result.success) {
      displayTranslation(result.translatedText, result.detectedLang, result.apiName);
      addToHistory(text, result.translatedText, sourceLang, targetLang, result.detectedLang);
    } else {
      showToast(result.error || 'Translation failed. Please try again.', 'error');
    }
  } catch (err) {
    console.error('Translation error:', err);
    showToast('Network error. Please check your internet connection.', 'error');
  } finally {
    setTranslatingState(false);
  }
}

/* ============================================================
   MULTI-API TRANSLATION ENGINE
   ============================================================ */

/**
 * Try each API provider in order, return first success.
 * @param {string} text       - Text to translate
 * @param {string} sourceLang - Source language code or 'auto'
 * @param {string} targetLang - Target language code
 * @returns {Promise<{success, translatedText, detectedLang, apiName, error}>}
 */
async function translateText(text, sourceLang, targetLang) {
  let lastError = 'All translation services failed.';

  for (const provider of API_PROVIDERS) {
    try {
      const result = await provider.call(text, sourceLang, targetLang);
      if (result.success) {
        return { ...result, apiName: provider.name };
      }
      lastError = result.error || lastError;
      console.warn(`[${provider.name}] failed:`, result.error);
    } catch (err) {
      lastError = err.message || lastError;
      console.warn(`[${provider.name}] threw:`, err);
    }
  }

  return { success: false, error: lastError };
}

/* ----------------------------------------------------------
   API 1: Google Translate (unofficial gtx client)
   Endpoint: translate.googleapis.com/translate_a/single?client=gtx
   ✔ No API key required  ✔ All languages  ✔ Any text length
   ✔ Returns detected language  ✔ Very reliable
   ---------------------------------------------------------- */
async function translateWithGoogle(text, sourceLang, targetLang) {
  const sl = sourceLang === 'auto' ? 'auto' : sourceLang;
  // Google GTX endpoint — same one used by the Google Translate widget
  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(targetLang)}` +
    `&dt=t&q=${encodeURIComponent(text)}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) throw new Error(`Google HTTP ${response.status}`);

  const data = await response.json();

  // data[0] = array of [translated_segment, source_segment, ...]
  // data[1] = detected source language code
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    return { success: false, error: 'Google: unexpected response format' };
  }

  const translatedText = data[0]
    .filter(seg => Array.isArray(seg) && seg[0])
    .map(seg => seg[0])
    .join('')
    .trim();

  if (!translatedText) return { success: false, error: 'Google: empty translation' };

  // Detected language is at data[1]
  let detectedLang = null;
  if (sourceLang === 'auto' && data[2]) {
    const code = data[2];
    detectedLang = LANGUAGES[code] || null;
  } else if (sourceLang === 'auto' && typeof data[1] === 'string') {
    detectedLang = LANGUAGES[data[1]] || null;
  }

  return { success: true, translatedText, detectedLang };
}

/* ----------------------------------------------------------
   API 2: MyMemory Translation API
   Endpoint: api.mymemory.translated.net/get
   ✔ No API key  ✔ 1,000 req/day free
   ⚠ 500-char limit per request — long text is auto-chunked
   ---------------------------------------------------------- */
async function translateWithMyMemory(text, sourceLang, targetLang) {
  const CHUNK = 480; // stay safely under the 500-char limit

  // Split text into chunks at sentence/word boundaries
  const chunks = splitChunks(text, CHUNK);
  const results = [];

  for (const chunk of chunks) {
    const r = await translateMyMemoryChunk(chunk, sourceLang, targetLang);
    if (!r.success) return r; // fail fast on any chunk error
    results.push(r);
  }

  const translatedText = results.map(r => r.translatedText).join(' ').trim();
  const detectedLang   = results[0]?.detectedLang || null;
  return { success: true, translatedText, detectedLang };
}

/** Translate a single chunk via MyMemory */
async function translateMyMemoryChunk(chunk, sourceLang, targetLang) {
  const langpair = sourceLang === 'auto'
    ? `autodetect|${targetLang}`
    : `${sourceLang}|${targetLang}`;

  const params = new URLSearchParams({ q: chunk, langpair });
  const url = `https://api.mymemory.translated.net/get?${params}`;

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) throw new Error(`MyMemory HTTP ${response.status}`);

  const data = await response.json();
  if (data.responseStatus !== 200) {
    return { success: false, error: data.responseDetails || 'MyMemory error' };
  }

  const translatedText = data.responseData?.translatedText;
  if (!translatedText) return { success: false, error: 'MyMemory: empty response' };

  // Normalize detected language code (e.g. "en-GB" → "en")
  let detectedLang = null;
  if (sourceLang === 'auto') {
    const matches  = data.matches || [];
    const rawCode  = matches[0]?.source || data.responseData?.detectedLanguage;
    if (rawCode) {
      const base    = rawCode.toLowerCase() === 'zh-tw' ? 'zh-TW' : rawCode.split('-')[0].toLowerCase();
      detectedLang  = LANGUAGES[base] || LANGUAGES[rawCode] || null;
    }
  }

  return { success: true, translatedText, detectedLang };
}

/**
 * Split text into chunks of at most maxLen characters,
 * preferring to break at sentence or word boundaries.
 */
function splitChunks(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    // Try sentence boundary first, then word boundary
    let idx = remaining.lastIndexOf('. ', maxLen);
    if (idx < maxLen * 0.4) idx = remaining.lastIndexOf(' ', maxLen);
    if (idx < 0) idx = maxLen;
    else idx += 1; // include the space / period
    chunks.push(remaining.slice(0, idx).trim());
    remaining = remaining.slice(idx).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

/* ----------------------------------------------------------
   API 3: Lingva Translate (Google mirror, multiple instances)
   ✔ No API key  ✔ Tries 3 public servers for resilience
   ---------------------------------------------------------- */
const LINGVA_INSTANCES = [
  'https://lingva.ml',
  'https://lingva.garudalinux.org',
  'https://translate.plausibility.cloud',
];

async function translateWithLingva(text, sourceLang, targetLang) {
  // Lingva encodes text in URL path — cap at 1500 chars to avoid 414 errors
  const safeText = text.length > 1500 ? text.slice(0, 1500) : text;
  const src = sourceLang === 'auto' ? 'auto' : sourceLang;
  const path = `/api/v1/${encodeURIComponent(src)}/${encodeURIComponent(targetLang)}/${encodeURIComponent(safeText)}`;

  for (const base of LINGVA_INSTANCES) {
    try {
      const response = await fetch(base + path, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) continue;

      const data = await response.json();
      const translatedText = data?.translation;
      if (!translatedText) continue;

      // Detected language from Lingva info object
      let detectedLang = null;
      if (sourceLang === 'auto') {
        const rawInfo = data?.info?.detectedSource;
        if (rawInfo) {
          const base2 = rawInfo.toLowerCase() === 'zh-tw' ? 'zh-TW' : rawInfo.split('-')[0].toLowerCase();
          detectedLang = LANGUAGES[base2] || null;
        }
      }

      return { success: true, translatedText, detectedLang };
    } catch {
      // Try next instance
      continue;
    }
  }

  return { success: false, error: 'Lingva: all instances unreachable' };
}

/** Update UI for translating/idle state */
function setTranslatingState(isTranslating) {
  state.isTranslating = isTranslating;
  dom.translateBtn.disabled = isTranslating;
  dom.loadingSpinner.style.display = isTranslating ? 'block' : 'none';

  // Toggle icon visibility
  const iconEl = dom.translateBtn.querySelector('svg');
  if (iconEl) iconEl.style.display = isTranslating ? 'none' : '';
}

/** Clear the output panel */
function clearOutput() {
  dom.outputText.innerHTML = '<span class="output-placeholder">Translating…</span>';
  dom.outputText.classList.remove('has-content');
  dom.detectedBadge.style.display = 'none';
  dom.copyBtn.disabled = true;
  dom.speakBtn.disabled = true;
  state.translatedText = '';
}

/**
 * Render translated text to output area
 * @param {string} text         - Translated text
 * @param {string|null} detectedLang - Detected language name (or null)
 * @param {string} apiName      - Name of the API that succeeded
 */
function displayTranslation(text, detectedLang, apiName) {
  state.translatedText = text;

  // Escape HTML entities to prevent XSS
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  dom.outputText.innerHTML = escaped;
  dom.outputText.classList.add('has-content');

  // Enable action buttons
  dom.copyBtn.disabled = false;
  // Enable TTS only if browser has a voice for the target language
  dom.speakBtn.disabled = !hasTTSVoice(dom.targetLang.value);

  // Show detected language badge (or API source if language unknown)
  if (detectedLang) {
    dom.detectedLangName.textContent = detectedLang;
    dom.detectedBadge.style.display = 'flex';
  } else if (apiName) {
    dom.detectedLangName.textContent = `via ${apiName}`;
    dom.detectedBadge.style.display = 'flex';
  } else {
    dom.detectedBadge.style.display = 'none';
  }
}

/* ============================================================
   CLEAR
   ============================================================ */

function handleClear() {
  dom.inputText.value = '';
  dom.outputText.innerHTML = '<span class="output-placeholder">Translation will appear here…</span>';
  dom.outputText.classList.remove('has-content');
  dom.detectedBadge.style.display = 'none';
  dom.copyBtn.disabled = true;
  dom.speakBtn.disabled = true;
  state.translatedText = '';
  stopSpeaking();
  updateCharCounter();
  dom.inputText.focus();
}

/* ============================================================
   SWAP LANGUAGES
   ============================================================ */

function handleSwap() {
  const srcVal = dom.sourceLang.value;
  const tgtVal = dom.targetLang.value;

  // Don't swap if source is "auto"
  if (srcVal === 'auto') {
    showToast('Set a specific source language to swap.', 'error');
    return;
  }

  // Animate swap button
  dom.swapBtn.classList.add('spinning');
  setTimeout(() => dom.swapBtn.classList.remove('spinning'), 500);

  // Swap language selections
  dom.sourceLang.value = tgtVal;
  dom.targetLang.value = srcVal;

  // Swap text content too (input ↔ translated)
  const currentInput = dom.inputText.value;
  if (state.translatedText) {
    dom.inputText.value = state.translatedText;
    updateCharCounter();
  }

  // Clear output
  dom.outputText.innerHTML = '<span class="output-placeholder">Translation will appear here…</span>';
  dom.outputText.classList.remove('has-content');
  dom.detectedBadge.style.display = 'none';
  dom.copyBtn.disabled = true;
  dom.speakBtn.disabled = true;
  state.translatedText = '';
}

/* ============================================================
   COPY TO CLIPBOARD
   ============================================================ */

async function handleCopy() {
  if (!state.translatedText) return;

  try {
    await navigator.clipboard.writeText(state.translatedText);
    showToast('✓ Translation copied to clipboard!');

    // Momentary visual feedback
    const originalText = dom.copyBtn.innerHTML;
    dom.copyBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Copied!`;
    dom.copyBtn.classList.add('active');
    setTimeout(() => {
      dom.copyBtn.innerHTML = originalText;
      dom.copyBtn.classList.remove('active');
    }, 2000);
  } catch (err) {
    // Fallback for older browsers
    try {
      const textarea = document.createElement('textarea');
      textarea.value = state.translatedText;
      textarea.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('✓ Translation copied to clipboard!');
    } catch (fallbackErr) {
      showToast('Copy failed. Please select text manually.', 'error');
    }
  }
}

/* ============================================================
   TEXT-TO-SPEECH
   ============================================================ */

/**
 * Check if the browser has a TTS voice for the given language code
 * @param {string} langCode - BCP-47 language code
 * @returns {boolean}
 */
function hasTTSVoice(langCode) {
  if (!state.speechSynthesis) return false;
  const voices = state.speechSynthesis.getVoices();
  if (!voices.length) return true; // voices not yet loaded — be optimistic
  const base = langCode.split('-')[0].toLowerCase();
  return voices.some(v => {
    const vBase = v.lang.split('-')[0].toLowerCase();
    return v.lang === langCode || vBase === base;
  });
}

function handleSpeak() {
  if (!state.speechSynthesis || !state.translatedText) return;

  if (state.isSpeaking) {
    stopSpeaking();
    return;
  }

  const targetLang = dom.targetLang.value;

  // Map language code to BCP-47 for SpeechSynthesis
  const langMap = { 'zh': 'zh-CN', 'zh-TW': 'zh-TW' };
  const speechLang = langMap[targetLang] || targetLang;

  // Check voices are actually available
  const voices = state.speechSynthesis.getVoices();
  const matchingVoice = voices.find(v => v.lang === speechLang) ||
                        voices.find(v => v.lang.startsWith(targetLang.split('-')[0]));

  if (voices.length && !matchingVoice) {
    showToast('No voice available for this language in your browser.', 'error');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(state.translatedText);
  utterance.lang = speechLang;
  if (matchingVoice) utterance.voice = matchingVoice;
  utterance.rate = 0.9;
  utterance.pitch = 1;

  utterance.onstart = () => {
    state.isSpeaking = true;
    dom.speakBtn.classList.add('speaking');
    dom.speakBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/>
        <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>
      </svg>
      Stop`;
  };

  utterance.onend = () => {
    resetSpeakButton();
  };

  utterance.onerror = (e) => {
    resetSpeakButton();
    // 'canceled' fires when we call cancel() ourselves — not an error
    if (e.error !== 'canceled') {
      showToast('No voice available for this language in your browser.', 'error');
    }
  };

  state.currentUtterance = utterance;
  state.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
  if (state.speechSynthesis) {
    state.speechSynthesis.cancel();
  }
  resetSpeakButton();
}

function resetSpeakButton() {
  state.isSpeaking = false;
  state.currentUtterance = null;
  dom.speakBtn.classList.remove('speaking');
  dom.speakBtn.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    Listen`;
}

/* ============================================================
   CHARACTER COUNTER
   ============================================================ */

function updateCharCounter() {
  const len = dom.inputText.value.length;
  dom.charCounter.textContent = `${len.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`;

  dom.charCounter.classList.remove('warning', 'danger');
  if (len > MAX_CHARS * 0.95) {
    dom.charCounter.classList.add('danger');
  } else if (len > MAX_CHARS * 0.8) {
    dom.charCounter.classList.add('warning');
  }
}

/* ============================================================
   DARK / LIGHT MODE
   ============================================================ */

function handleThemeToggle() {
  const newTheme = state.currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  localStorage.setItem('linguaflow-theme', newTheme);
}

function applyTheme(theme) {
  state.currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);

  if (theme === 'dark') {
    dom.moonIcon.style.display = '';
    dom.sunIcon.style.display  = 'none';
  } else {
    dom.moonIcon.style.display = 'none';
    dom.sunIcon.style.display  = '';
  }
}

function loadThemeFromStorage() {
  const saved = localStorage.getItem('linguaflow-theme') || 'dark';
  applyTheme(saved);
}

/* ============================================================
   TRANSLATION HISTORY
   ============================================================ */

/**
 * Add a translation to the history array and persist to localStorage
 */
function addToHistory(sourceText, translatedText, sourceLang, targetLang, detectedLang) {
  const srcLangName = sourceLang === 'auto'
    ? (detectedLang || 'Auto')
    : (LANGUAGES[sourceLang] || sourceLang);
  const tgtLangName = LANGUAGES[targetLang] || targetLang;

  const entry = {
    id:             Date.now(),
    sourceText:     sourceText.substring(0, 200),
    translatedText: translatedText.substring(0, 200),
    srcLangName,
    tgtLangName,
    timestamp:      new Date().toISOString(),
  };

  // Prepend and limit
  state.history.unshift(entry);
  if (state.history.length > MAX_HISTORY) {
    state.history.pop();
  }

  persistHistory();
  renderHistory();
}

function persistHistory() {
  try {
    localStorage.setItem('linguaflow-history', JSON.stringify(state.history));
  } catch (e) {
    console.warn('Could not save history:', e);
  }
}

function loadHistoryFromStorage() {
  try {
    const saved = localStorage.getItem('linguaflow-history');
    if (saved) {
      state.history = JSON.parse(saved);
      renderHistory();
    }
  } catch (e) {
    console.warn('Could not load history:', e);
    state.history = [];
  }
}

function handleClearHistory() {
  state.history = [];
  persistHistory();
  renderHistory();
  showToast('History cleared.');
}

/** Render history items into the DOM */
function renderHistory() {
  if (!state.history.length) {
    dom.historyList.innerHTML = `
      <div class="history-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" opacity="0.3">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
          <polyline points="12 6 12 12 16 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p>No translations yet.<br>Start translating to see your history here.</p>
      </div>`;
    return;
  }

  dom.historyList.innerHTML = state.history.map(entry => `
    <div class="history-item" role="listitem" data-id="${entry.id}" tabindex="0"
         aria-label="Translation from ${entry.srcLangName} to ${entry.tgtLangName}">
      <div class="history-text">${escapeHtml(entry.sourceText)}</div>
      <div class="history-arrow">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <polyline points="12 5 19 12 12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="history-translation">${escapeHtml(entry.translatedText)}</div>
      <div class="history-meta">
        <span class="history-lang-tag">${escapeHtml(entry.srcLangName)}</span>
        <span style="color:var(--text-secondary);font-size:10px;">→</span>
        <span class="history-lang-tag">${escapeHtml(entry.tgtLangName)}</span>
        <span class="history-time">${formatTime(entry.timestamp)}</span>
      </div>
    </div>
  `).join('');

  // Click/keyboard to restore from history
  dom.historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => restoreFromHistory(parseInt(item.dataset.id)));
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') restoreFromHistory(parseInt(item.dataset.id));
    });
  });
}

/** Restore a history entry into the translator fields */
function restoreFromHistory(id) {
  const entry = state.history.find(h => h.id === id);
  if (!entry) return;

  dom.inputText.value = entry.sourceText;
  updateCharCounter();

  // Try to match language names back to codes
  const srcCode = Object.entries(LANGUAGES).find(([, name]) => name === entry.srcLangName)?.[0];
  const tgtCode = Object.entries(LANGUAGES).find(([, name]) => name === entry.tgtLangName)?.[0];

  if (srcCode) dom.sourceLang.value = srcCode;
  if (tgtCode) dom.targetLang.value = tgtCode;

  displayTranslation(entry.translatedText, null);
  showToast('✓ History entry restored.');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */

/**
 * Show a toast notification
 * @param {string} message - Notification text
 * @param {'info'|'error'} type - Toast type
 */
function showToast(message, type = 'info') {
  clearTimeout(state.toastTimer);

  dom.toast.textContent = message;
  dom.toast.className = 'toast' + (type === 'error' ? ' error' : '');

  // Force reflow for re-triggering animation
  void dom.toast.offsetWidth;
  dom.toast.classList.add('show');

  state.toastTimer = setTimeout(() => {
    dom.toast.classList.remove('show');
  }, 3000);
}

/* ============================================================
   UTILITIES
   ============================================================ */

/** Escape HTML to prevent XSS in dynamically rendered content */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format an ISO timestamp into a relative or human-readable time */
function formatTime(iso) {
  try {
    const date = new Date(iso);
    const now  = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1)    return 'just now';
    if (diffMin < 60)   return `${diffMin}m ago`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */

// Initialize once the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
