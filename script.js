const languages = {
  auto: "Detect language",
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  hi: "Hindi",
  zh: "Chinese (Simplified)",
  ja: "Japanese",
  ru: "Russian",
  ar: "Arabic"
};

const sourceLanguage = document.getElementById("source-language");
const targetLanguage = document.getElementById("target-language");
const sourceText = document.getElementById("source-text");
const translatedText = document.getElementById("translated-text");
const translateButton = document.getElementById("translate-button");
const copyButton = document.getElementById("copy-button");
const speakButton = document.getElementById("speak-button");

const API_KEY = "<YOUR_TRANSLATOR_API_KEY>";
const API_REGION = "<YOUR_TRANSLATOR_RESOURCE_REGION>";
const ENDPOINT = "https://api.cognitive.microsofttranslator.com";

function populateLanguageOptions() {
  Object.entries(languages).forEach(([code, name]) => {
    const option1 = document.createElement("option");
    option1.value = code;
    option1.textContent = `${name} (${code})`;
    sourceLanguage.appendChild(option1);

    if (code !== "auto") {
      const option2 = document.createElement("option");
      option2.value = code;
      option2.textContent = `${name} (${code})`;
      targetLanguage.appendChild(option2);
    }
  });

  sourceLanguage.value = "auto";
  targetLanguage.value = "en";
}

async function translateText() {
  const text = sourceText.value.trim();
  const from = sourceLanguage.value;
  const to = targetLanguage.value;

  if (!text) {
    alert("Please enter text to translate.");
    return;
  }

  if (!API_KEY || API_KEY.startsWith("<")) {
    translatedText.value = "Please configure your Microsoft Translator API key and region in script.js.";
    return;
  }

  translateButton.disabled = true;
  translateButton.textContent = "Translating...";

  try {
    const route = `/translate?api-version=3.0&to=${encodeURIComponent(to)}${from !== "auto" ? `&from=${encodeURIComponent(from)}` : ""}`;
    const response = await fetch(`${ENDPOINT}${route}`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": API_KEY,
        "Ocp-Apim-Subscription-Region": API_REGION,
        "Content-Type": "application/json"
      },
      body: JSON.stringify([{ Text: text }])
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Translation request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    translatedText.value = data[0]?.translations?.[0]?.text || "No translation result returned.";
  } catch (error) {
    translatedText.value = `Error: ${error.message}`;
  } finally {
    translateButton.disabled = false;
    translateButton.textContent = "Translate";
  }
}

function copyTranslation() {
  const value = translatedText.value.trim();
  if (!value) {
    return;
  }

  navigator.clipboard.writeText(value).then(() => {
    copyButton.textContent = "Copied!";
    setTimeout(() => { copyButton.textContent = "Copy translation"; }, 1400);
  });
}

function speakTranslation() {
  const text = translatedText.value.trim();
  if (!text) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = targetLanguage.value;
  speechSynthesis.speak(utterance);
}

translateButton.addEventListener("click", translateText);
copyButton.addEventListener("click", copyTranslation);
speakButton.addEventListener("click", speakTranslation);

populateLanguageOptions();
