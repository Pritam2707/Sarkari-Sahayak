// content.js - Sarkari Sahayak Form Scanner & Filler

(function () {
  // Prevent duplicate injection
  if (window.__SARKARI_SAHAYAK_INJECTED__) return;
  window.__SARKARI_SAHAYAK_INJECTED__ = true;

  console.log("[Sarkari Sahayak] Content script loaded on:", window.location.href);

  let fieldIdCounter = 0;

  // Convert Indic numerals (Bengali ০-৯, Devanagari ०-९) to ASCII 0-9
  function normalizeIndicDigits(str) {
    if (!str) return str;
    const s = String(str);
    const indicMap = {
      '০':'0', '১':'1', '২':'2', '৩':'3', '৪':'4', '৫':'5', '৬':'6', '৭':'7', '৮':'8', '৯':'9',
      '०':'0', '१':'1', '२':'2', '३':'3', '४':'4', '५':'5', '६':'6', '७':'7', '८':'8', '९':'9'
    };
    return s.replace(/[০-৯०-९]/g, d => indicMap[d] || d);
  }

  // Common regional translations for selects and radio buttons
  const TRANSLATIONS = {
    "পুরুষ": "male", "মহিলা": "female", "অন্যান্য": "other",
    "पुरुष": "male", "महिला": "female", "अन्य": "other",
    "পশ্চিমবঙ্গ": "WB", "পশ্চিম বঙ্গ": "WB", "কলকাতা": "Kolkata",
    "पश्चिम बंगाल": "WB", "दिल्ली": "DL", "महाराष्ट्र": "MH",
    "male": "male", "female": "female", "other": "other"
  };

  // Helper: check if element is visible
  function isVisible(el) {
    if (!el) return false;
    if (el.type === "hidden") return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
    if (el.offsetParent === null && style.position !== "fixed") {
      return false;
    }
    return true;
  }

  // Helper: extract best possible human-readable label
  function getFieldLabel(el) {
    // 1. Explicit <label for="...">
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label && label.innerText.trim()) {
        return label.innerText.trim();
      }
    }

    // 2. Enclosing <label>
    const parentLabel = el.closest("label");
    if (parentLabel && parentLabel.innerText.trim()) {
      const clone = parentLabel.cloneNode(true);
      const inputs = clone.querySelectorAll("input, select, textarea");
      inputs.forEach(i => i.remove());
      const txt = clone.innerText.trim();
      if (txt) return txt;
    }

    // 3. aria-labelledby
    const labelledby = el.getAttribute("aria-labelledby");
    if (labelledby) {
      const parts = labelledby.split(/\s+/).map(id => document.getElementById(id)).filter(Boolean);
      const text = parts.map(p => p.innerText.trim()).join(" ");
      if (text) return text;
    }

    // 4. aria-label
    if (el.getAttribute("aria-label")) {
      return el.getAttribute("aria-label").trim();
    }

    // 5. Placeholder
    if (el.placeholder && el.placeholder.trim()) {
      return el.placeholder.trim();
    }

    // 6. Preceding sibling or nearby text node
    let prev = el.previousElementSibling;
    while (prev) {
      if (prev.tagName.toLowerCase() === "label" || prev.innerText?.trim()) {
        const txt = prev.innerText?.trim();
        if (txt && txt.length < 50) return txt;
      }
      prev = prev.previousElementSibling;
    }

    // 7. Table row / form-group label
    const group = el.closest(".form-group, .field, tr, td, .form-row, .col, div");
    if (group) {
      const lbl = group.querySelector("label, .label, th");
      if (lbl && lbl !== el && lbl.innerText.trim()) {
        return lbl.innerText.trim();
      }
    }

    // 8. Fallback to name or id or type
    return el.name || el.id || el.type || "Unnamed Field";
  }

  // Scan all actionable form fields
  function scanFields() {
    const rawElements = Array.from(
      document.querySelectorAll("input, select, textarea")
    );

    const validElements = rawElements.filter(el => {
      if (!isVisible(el)) return false;
      const type = (el.type || "").toLowerCase();
      // Skip buttons and submit triggers
      if (["submit", "button", "reset", "image", "file"].includes(type)) return false;
      return true;
    });

    const scannedFields = [];
    const radioGroups = new Map();

    validElements.forEach((el) => {
      const type = (el.type || el.tagName.toLowerCase()).toLowerCase();

      // Handle grouped radios (deterministic ID without random counter)
      if (type === "radio") {
        const groupName = el.name || "unnamed_radio";
        const groupVfId = `vf_rg_${groupName.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
        if (!radioGroups.has(groupName)) {
          radioGroups.set(groupName, {
            id: groupVfId,
            name: groupName,
            type: "radio",
            label: getFieldLabel(el) || groupName,
            options: [],
            elements: []
          });
        }

        const group = radioGroups.get(groupName);
        let radioVfId = el.getAttribute("data-vf-id");
        if (!radioVfId) {
          radioVfId = `vf_r_${++fieldIdCounter}`;
          el.setAttribute("data-vf-id", radioVfId);
        }
        el.setAttribute("data-vf-group", group.id);

        const optionLabel = getFieldLabel(el) || el.value;
        group.options.push({
          value: el.value,
          label: optionLabel,
          vfId: radioVfId
        });
        group.elements.push(el);
        return;
      }

      // Standard input, select, textarea
      let vfId = el.getAttribute("data-vf-id");
      if (!vfId) {
        vfId = `vf_${++fieldIdCounter}`;
        el.setAttribute("data-vf-id", vfId);
      }

      let options = null;
      if (el.tagName.toLowerCase() === "select") {
        options = Array.from(el.options).map(opt => ({
          value: opt.value,
          text: opt.text.trim()
        }));
      }

      scannedFields.push({
        id: vfId,
        name: el.name || "",
        domId: el.id || "",
        label: getFieldLabel(el),
        type: type,
        currentValue: el.value || "",
        options: options
      });
    });

    // Add grouped radios to field list
    radioGroups.forEach((group) => {
      scannedFields.push({
        id: group.id,
        name: group.name,
        domId: "",
        label: group.label,
        type: "radio",
        currentValue: group.elements.find(r => r.checked)?.value || "",
        options: group.options
      });
    });

    console.log(`[Sarkari Sahayak] Scanned ${scannedFields.length} interactive fields.`);
    return scannedFields;
  }

  // React/Vue/Angular safe native value setter that triggers synthetic events
  function setNativeValue(element, value) {
    const isCheckbox = element.type === "checkbox";
    const isRadio = element.type === "radio";
    const propName = isCheckbox || isRadio ? "checked" : "value";

    let finalVal = value;
    if (isCheckbox) {
      finalVal = (value === true || value === "true" || value === "1" || value === "yes" || value === "checked");
    }

    try {
      let proto = window.HTMLInputElement?.prototype;
      if (element.tagName === "TEXTAREA") proto = window.HTMLTextAreaElement?.prototype;
      if (element.tagName === "SELECT") proto = window.HTMLSelectElement?.prototype;

      const descriptor = Object.getOwnPropertyDescriptor(proto, propName);
      if (descriptor && descriptor.set) {
        descriptor.set.call(element, finalVal);
      } else {
        element[propName] = finalVal;
      }
    } catch (_) {
      element[propName] = finalVal;
    }

    // Direct property assignment fallback
    try { element[propName] = finalVal; } catch (_) {}

    // Dispatch bubbling events so React, Angular, Vue, and vanilla listeners detect the change
    element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
  }

  // Format date to strict YYYY-MM-DD for <input type="date">
  function normalizeDate(val) {
    if (!val) return val;
    val = normalizeIndicDigits(String(val).trim());

    // Month names conversion (English, Bengali, Hindi)
    const months = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
      জানুয়ারি: "01", ফেব্রুয়ারি: "02", মার্চ: "03", এপ্রিল: "04", মে: "05", জুন: "06",
      জুলাই: "07", আগস্ট: "08", সেপ্টেম্বর: "09", অক্টোবর: "10", নভেম্বর: "11", ডিসেম্বর: "12",
      जनवरी: "01", फरवरी: "02", मार्च: "03", अप्रैल: "04", मई: "05", जून: "06",
      जुलाई: "07", अगस्त: "08", सितंबर: "09", अक्टूबर: "10", नवंबर: "11", दिसंबर: "12"
    };

    let processed = val.toLowerCase();
    for (const [mName, mNum] of Object.entries(months)) {
      if (processed.includes(mName)) {
        processed = processed.replace(mName, mNum);
        break;
      }
    }

    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(processed)) return processed;

    // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
    const dmy = processed.match(/(\d{1,2})[-/.\s]+(\d{1,2})[-/.\s]+(\d{4})/);
    if (dmy) {
      return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    }

    // YYYY/MM/DD
    const ymd = processed.match(/(\d{4})[-/.\s]+(\d{1,2})[-/.\s]+(\d{1,2})/);
    if (ymd) {
      return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
    }

    // Attempt Date parse
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, "0");
      const d = String(parsed.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return val;
  }

  // Highlight element on page with 2px accent outline per DESIGN.md
  function highlightElement(el) {
    el.style.outline = "2px solid #cba6f7";
    el.style.boxShadow = "0 0 10px rgba(203, 166, 247, 0.4)";
    el.style.transition = "outline 0.25s ease, box-shadow 0.25s ease";

    // Auto-scroll element into view
    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (_) {}
  }

  // Bulletproof finder for any input/select/textarea by id, name, label, or vf-id
  function findElement(key) {
    if (!key) return null;
    const k = String(key).trim();
    const lowerK = k.toLowerCase();

    // 1. By data-vf-id
    let el = document.querySelector(`[data-vf-id="${CSS.escape(k)}"]`);
    if (el) return el;

    // 2. By DOM ID
    el = document.getElementById(k);
    if (el && isVisible(el)) return el;

    // 3. By exact name attribute
    el = document.querySelector(`[name="${CSS.escape(k)}"]`);
    if (el && isVisible(el)) return el;

    // 4. Case-insensitive name or ID
    const allInputs = Array.from(document.querySelectorAll("input, select, textarea")).filter(isVisible);
    el = allInputs.find(i => (i.name && i.name.toLowerCase() === lowerK) || (i.id && i.id.toLowerCase() === lowerK));
    if (el) return el;

    // 5. Match by exact label or placeholder
    el = allInputs.find(i => {
      const lbl = (getFieldLabel(i) || "").toLowerCase();
      const ph = (i.placeholder || "").toLowerCase();
      return lbl === lowerK || ph === lowerK;
    });
    if (el) return el;

    // 6. Substring match by label / name
    const strippedK = lowerK.replace(/[^a-z0-9]/g, "");
    if (strippedK.length >= 3) {
      el = allInputs.find(i => {
        const fn = (i.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const fid = (i.id || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const fl = (getFieldLabel(i) || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        return fn.includes(strippedK) || strippedK.includes(fn) ||
               fid.includes(strippedK) || strippedK.includes(fid) ||
               fl.includes(strippedK) || strippedK.includes(fl);
      });
      if (el) return el;
    }

    return null;
  }

  // Find radio group buttons by key
  function findRadioGroup(key) {
    if (!key) return [];
    const k = String(key).trim();
    const lowerK = k.toLowerCase().replace(/[^a-z0-9]/g, "");

    // 1. By data-vf-group
    let radios = Array.from(document.querySelectorAll(`[data-vf-group="${CSS.escape(k)}"]`));
    if (radios.length > 0) return radios;

    // 2. By radio name attribute
    radios = Array.from(document.querySelectorAll(`input[type="radio"][name="${CSS.escape(k)}"]`));
    if (radios.length > 0) return radios;

    // 3. Fuzzy match radio group
    const allRadios = Array.from(document.querySelectorAll('input[type="radio"]')).filter(isVisible);
    radios = allRadios.filter(r => {
      const rName = (r.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const rGroup = (r.getAttribute("data-vf-group") || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const rLabel = (getFieldLabel(r) || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      return rName === lowerK || rGroup.includes(lowerK) || lowerK.includes(rGroup) || rLabel.includes(lowerK);
    });

    return radios;
  }

  // Fill single field
  function fillTarget(targetKey, rawValue) {
    if (rawValue === undefined || rawValue === null || rawValue === "") return false;

    // 1. Try Radio Group first
    const radioElements = findRadioGroup(targetKey);
    if (radioElements.length > 0) {
      const targetVal = String(rawValue).trim().toLowerCase();
      const translatedVal = TRANSLATIONS[targetVal] || targetVal;
      let matched = false;

      radioElements.forEach(radio => {
        const rVal = String(radio.value).trim().toLowerCase();
        const rLabel = (getFieldLabel(radio) || "").toLowerCase();
        if (
          rVal === targetVal || rVal === translatedVal ||
          rLabel.includes(targetVal) || rLabel.includes(translatedVal) ||
          targetVal.includes(rVal) || translatedVal.includes(rVal)
        ) {
          setNativeValue(radio, true);
          highlightElement(radio);
          matched = true;
        }
      });
      if (matched) return true;
    }

    // 2. Normal Element
    const el = findElement(targetKey);
    if (!el) return false;

    const type = (el.type || el.tagName.toLowerCase()).toLowerCase();

    // Date
    if (type === "date") {
      const dateVal = normalizeDate(rawValue);
      setNativeValue(el, dateVal);
      highlightElement(el);
      return true;
    }

    // Select dropdown
    if (el.tagName.toLowerCase() === "select") {
      const search = String(rawValue).trim().toLowerCase();
      const translated = TRANSLATIONS[search] || search;
      let matchedIndex = -1;

      // 1. Exact value match
      for (let i = 0; i < el.options.length; i++) {
        const optVal = el.options[i].value.toLowerCase();
        if (optVal === search || optVal === translated) {
          matchedIndex = i;
          break;
        }
      }

      // 2. Exact or substring text match
      if (matchedIndex === -1) {
        for (let i = 0; i < el.options.length; i++) {
          const optText = el.options[i].text.trim().toLowerCase();
          if (optText === search || optText === translated || optText.includes(search) || search.includes(optText)) {
            matchedIndex = i;
            break;
          }
        }
      }

      if (matchedIndex !== -1) {
        el.selectedIndex = matchedIndex;
        setNativeValue(el, el.options[matchedIndex].value);
        highlightElement(el);
        return true;
      }
      return false;
    }

    // Numeric / Tel fields: ensure Indic numerals are normalized to ASCII 0-9
    let finalVal = rawValue;
    if (["tel", "number"].includes(type) || targetKey.includes("phone") || targetKey.includes("pincode")) {
      finalVal = normalizeIndicDigits(String(rawValue)).replace(/[^0-9]/g, "");
    }

    // Standard input, textarea, checkbox
    setNativeValue(el, finalVal);
    highlightElement(el);
    return true;
  }

  // Fill dictionary of fields
  function fillFields(valuesDict) {
    if (!valuesDict || typeof valuesDict !== "object") {
      return { success: false, error: "Invalid values dictionary" };
    }

    console.log("[Sarkari Sahayak] Executing fillFields with:", valuesDict);
    const filled = [];
    const unfilled = [];

    // Ensure all DOM fields are tagged
    scanFields();

    for (const [key, val] of Object.entries(valuesDict)) {
      if (val === undefined || val === null || val === "") continue;

      const success = fillTarget(key, val);
      if (success) {
        const el = findElement(key);
        const reportId = el?.getAttribute("data-vf-id") || key;
        filled.push({ id: reportId, key, value: val });
      } else {
        unfilled.push({ id: key, value: val });
      }
    }

    console.log(`[Sarkari Sahayak] Fill Result: ${filled.length} filled, ${unfilled.length} unfilled.`);
    return { success: true, filled, unfilled };
  }

  // Clear all highlights
  function clearHighlights() {
    document.querySelectorAll("[data-vf-id], [data-vf-group]").forEach(el => {
      el.style.outline = "";
      el.style.boxShadow = "";
    });
  }

  // Message listener for runtime messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      if (message.action === "PING") {
        sendResponse({ success: true, pong: true });
        return true;
      }

      if (message.action === "SCAN_FIELDS") {
        const fields = scanFields();
        sendResponse({ success: true, fields: fields });
        return true;
      }

      if (message.action === "FILL_FIELDS") {
        const result = fillFields(message.values);
        sendResponse(result);
        return true;
      }

      if (message.action === "CLEAR_HIGHLIGHTS") {
        clearHighlights();
        sendResponse({ success: true });
        return true;
      }

      if (message.action === "HIGHLIGHT_FIELD") {
        const el = findElement(message.id);
        if (el) highlightElement(el);
        sendResponse({ success: true });
        return true;
      }
    } catch (err) {
      console.error("[Sarkari Sahayak] Content error:", err);
      sendResponse({ success: false, error: err.message });
      return true;
    }
  });

})();
