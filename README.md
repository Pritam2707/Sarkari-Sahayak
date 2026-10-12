# Sarkari Sahayak 🇮🇳
### Voice-First Web Form Filling Extension Powered by Sarvam AI

[![Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?logo=googlechrome&logoColor=white)](#)
[![Sarvam AI](https://img.shields.io/badge/Powered_by-Sarvam_AI-8B5CF6)](#)
[![Zero Build Steps](https://img.shields.io/badge/Stack-Vanilla_JS_%7C_No_Dependencies-brightgreen)](#)

> **Sarkari Sahayak** is a Chromium browser extension that allows Indian citizens to fill complex government, scholarship, and public welfare forms simply by speaking in their regional language (Bengali, Hindi, and 9+ Indian languages).

---

## 💡 The Problem

Millions of citizens face friction when applying for government schemes, admissions, and welfare subsidies online:
- Web forms are often cluttered, complex, and only available in standard English or formal script.
- Typing in regional languages using conventional keyboards is slow and cumbersome on desktop browsers.
- Traditional assistive tools require users to copy-paste between external translation tabs.

## 🚀 The Solution

**Sarkari Sahayak** lives directly in the browser side panel. It scans the active web page, identifies form fields (names, dates, dropdowns, radios, textareas), captures the applicant's spoken voice, and automatically fills and highlights the matching fields on the open page.

---

## 🧠 Sarvam AI Pipeline

```
[ User Speaks ]
      │
      ▼
[ Side Panel MediaRecorder (28s auto-cutoff) ]
      │
      ▼ (audio/webm)
[ Saaras v4 STT (api.sarvam.ai/speech-to-text) ]
      │
      ▼ (Regional transcript: e.g. Bengali / Hindi)
[ Sarvam-105B LLM (api.sarvam.ai/v1/chat/completions) ]
      │  Prompted with DOM fields + transcript
      ▼
[ Structured JSON Mapping ]
      │
      ▼
[ Content Script Dom Injector ]
  - React/Angular native value setter bypass
  - Bubbling `input` & `change` synthetic events
  - Indic numeral translation (০-৯, ०-९ ➔ 0-9)
  - Strict YYYY-MM-DD date normalization
  - Visual accent outline (#cba6f7) & green checkmarks
```

### Sarvam Models Used:
1. **Saaras v4 (`saaras:v4`)**: Indian language Speech-to-Text with high-accuracy transcription for regional accents and code-mixed speech.
2. **Sarvam-105B (`sarvam-105b`)**: Indian multilingual reasoning LLM used to extract semantic values and map them into structured form fields.
3. **Bulbul v4-flash (`bulbul:v4-flash`)**: Text-to-Speech synthesis for verifying and reading back filled form data to the user.

---

## 📁 Repository Structure

```
Sarkari-Sahayak/
├── voice-filler/
│   ├── manifest.json       # Manifest V3 extension configuration
│   ├── background.js      # Service worker: proxy for Sarvam AI STT, LLM & TTS
│   ├── content.js         # DOM field scanner, event dispatcher & highlighter
│   ├── sidepanel.html     # Dark-themed side panel interface per DESIGN.md
│   ├── sidepanel.js       # Recording, countdown timer & state management
│   ├── config.js          # Sarvam endpoints, model names, mock datasets
│   ├── permission.html    # One-time microphone setup page for side panel
│   ├── permission.js      # Microphone permission requester
│   └── demo-form.html     # Realistic demo portal for testing
├── design.md              # UI/UX guidelines and color tokens
├── rules.md               # Architecture requirements and constraints
└── README.md
```

---

## 🛠️ Installation & Setup

### 1. Load Unpacked Extension in Chrome / Brave / Edge

1. Open your browser and navigate to:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
   - Edge: `edge://extensions`
2. Toggle on **Developer mode** (top-right corner).
3. Click **Load unpacked** (top-left corner).
4. Select the folder: `D:\SarvamHacakthon\voice-filler` (or your cloned repository's `voice-filler` folder).
5. Pin **Sarkari Sahayak** to your browser toolbar.

### 2. Configure Your Sarvam AI Key

Choose either method:
- **Runtime UI (Recommended)**: Click the **Mock Mode** badge in the side panel header, paste your Sarvam API Key (`sk_...`), and click **Save**.
- **In File**: Open [`voice-filler/config.js`](voice-filler/config.js), paste your key in `API_KEY: "sk_..."`, and set `MOCK: false`.

### 3. Grant Microphone Permission (One-Time)

Because Chrome restricts side panels from showing permission prompts directly:
1. Open a new tab and visit:
   ```text
   chrome-extension://<EXTENSION_ID>/permission.html
   ```
   *(Or click the "Open Microphone Permission Page" button inside the side panel error banner).*
2. Click **Allow Microphone** and approve the browser prompt.
3. Close the tab.

---

## 🧪 5-Step Testing Guide

1. **Open the Demo Form**:
   - Open [`voice-filler/demo-form.html`](voice-filler/demo-form.html) in your browser tab.
   - Click the **Sarkari Sahayak** extension icon to launch the side panel.
2. **Verify Field Detection**:
   - The status bar will read **Ready**, and the detected fields counter will show **9 fields** (Applicant Name, Father's Name, DOB, Gender, Mobile, Email, Address, State, PIN).
3. **Test Hardcoded Fill (Step 3a)**:
   - Click **⚡ Hardcoded Fill**.
   - Watch the active form populate instantly with test data and display a `2px` purple outline (`#cba6f7`).
   - The field list in the side panel turns into green checkmarks (`✓`).
4. **Test Live Voice Recording (Step 3b & 3c)**:
   - Tap the large circular **Mic** button.
   - Speak your details in Bengali, Hindi, or English (e.g. *"Amar naam Rahul Sharma, mobile 9876543210, date of birth 15th August 1995..."*).
   - Tap the mic to finish (or let the **28s auto-cutoff** safeguard stop automatically).
   - Saaras v4 transcribes your speech &rarr; Sarvam-105B extracts the fields &rarr; form fields populate on the web page.
5. **Test Voice Read-Back (Stretch)**:
   - Click **🔊 Read Back** to hear Bulbul TTS read out the filled form details in your chosen language.

---

## 🛡️ Safety & Privacy Principles

- **Zero Auto-Submission**: The extension **never** clicks the submit button. It fills and visually highlights the form, ensuring the citizen has 100% oversight before submitting.
- **Client-Side Audio**: Microphone audio is captured directly in the user's browser and communicated securely over HTTPS to Sarvam AI endpoints.
- **Works on Any Web Page**: Built using generalized DOM heuristics (`label[for]`, `aria-label`, placeholder, and tree traversals), allowing it to adapt to state portals, scholarship portals, and standard HTML forms without custom page integrations.

---

## 👥 Author

- **Name:** Pritam Bhunia
- **Institution:** Jadavpur University
- **Repository:** [https://github.com/Pritam2707/Sarkari-Sahayak](https://github.com/Pritam2707/Sarkari-Sahayak)
