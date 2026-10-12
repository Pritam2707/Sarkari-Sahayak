// config.js - Configuration, Sarvam API constants, and mock data for Sarkari Sahayak

const CONFIG = {
  // Put your Sarvam AI API Key here or in extension settings

  // MOCK MODE: Set to false to use live Sarvam AI endpoints. Set to true for offline demo/testing.
  MOCK: true,

  // Default Language
  DEFAULT_LANGUAGE: "bn-IN",

  // Supported Indian Languages
  LANGUAGES: [
    { code: "bn-IN", name: "Bengali (বাংলা)" },
    { code: "hi-IN", name: "Hindi (हिन्दी)" },
    { code: "en-IN", name: "English (Indian)" },
    { code: "ta-IN", name: "Tamil (தமிழ்)" },
    { code: "te-IN", name: "Telugu (తెలుగు)" },
    { code: "mr-IN", name: "Marathi (मराठी)" },
    { code: "gu-IN", name: "Gujarati (ગુજરાતી)" },
    { code: "kn-IN", name: "Kannada (ಕನ್ನಡ)" },
    { code: "ml-IN", name: "Malayalam (മലയാളം)" },
    { code: "pa-IN", name: "Punjabi (ਪੰਜਾਬੀ)" },
    { code: "od-IN", name: "Odia (ଓଡ଼ିଆ)" }
  ],

  // Sarvam AI Endpoints & Models
  ENDPOINTS: {
    STT: "https://api.sarvam.ai/speech-to-text",
    CHAT: "https://api.sarvam.ai/v1/chat/completions",
    TTS: "https://api.sarvam.ai/text-to-speech"
  },

  MODELS: {
    STT: "saaras:v4",
    CHAT: "sarvam-105b",
    TTS: "bulbul:v4-flash"
  },

  TTS_SPEAKER: "shubh_enhi_ads",

  // Auth Header Key
  AUTH_HEADER_NAME: "api-subscription-key",

  // Mock canned responses for offline testing / fallback
  MOCK_DATA: {
    "bn-IN": {
      transcript: "আমার নাম রাহুল শর্মা, পিতার নাম রমেশ শর্মা, জন্ম তারিখ ১৫ আগস্ট ১৯৯৫, ফোন নম্বর ৯৮৭৬৫৪৩২১০, ইমেল rahul.sharma@example.com, ঠিকানা ১২ বিপিন বিহারী গাঙ্গুলী স্ট্রিট, কলকাতা, পিন কোড ৭০০০০১, লিঙ্গ পুরুষ, রাজ্য পশ্চিমবঙ্গ।",
      fieldValues: {
        "name": "রাহুল শর্মা",
        "full_name": "Rahul Sharma",
        "father_name": "Ramesh Sharma",
        "dob": "1995-08-15",
        "phone": "9876543210",
        "email": "rahul.sharma@example.com",
        "address": "12 Bipin Behari Ganguly Street, Kolkata",
        "city": "Kolkata",
        "pincode": "700001",
        "gender": "male",
        "state": "WB"
      }
    },
    "hi-IN": {
      transcript: "मेरा नाम राहुल शर्मा है, पिता का नाम रमेश शर्मा, जन्म तिथि 15 अगस्त 1995, मोबाइल 9876543210, ईमेल rahul.sharma@example.com, पता 12 मालवीय नगर, नई दिल्ली, पिन 110017, लिंग पुरुष।",
      fieldValues: {
        "name": "Rahul Sharma",
        "father_name": "Ramesh Sharma",
        "dob": "1995-08-15",
        "phone": "9876543210",
        "email": "rahul.sharma@example.com",
        "address": "12 Malviya Nagar, New Delhi",
        "city": "New Delhi",
        "pincode": "110017",
        "gender": "male",
        "state": "DL"
      }
    },
    "en-IN": {
      transcript: "My name is Rahul Sharma, father's name Ramesh Sharma, date of birth 15th August 1995, phone number 9876543210, email rahul.sharma@example.com, address 12 Park Street, Kolkata, pin code 700001, gender male.",
      fieldValues: {
        "name": "Rahul Sharma",
        "father_name": "Ramesh Sharma",
        "dob": "1995-08-15",
        "phone": "9876543210",
        "email": "rahul.sharma@example.com",
        "address": "12 Park Street, Kolkata",
        "city": "Kolkata",
        "pincode": "700001",
        "gender": "male",
        "state": "WB"
      }
    }
  },

  // Hardcoded test payload to test Step 3a instantly on any form
  HARDCODED_TEST_PAYLOAD: {
    "name": "Rahul Sharma",
    "fullName": "Rahul Sharma",
    "full_name": "Rahul Sharma",
    "applicant_name": "Rahul Sharma",
    "father_name": "Ramesh Sharma",
    "dob": "1995-08-15",
    "email": "rahul.sharma@example.com",
    "phone": "9876543210",
    "mobile": "9876543210",
    "address": "12 Bipin Behari Ganguly Street, Kolkata",
    "pincode": "700001",
    "gender": "male",
    "state": "WB"
  }
};

// Export for ES modules or global context
if (typeof module !== "undefined" && module.exports) {
  module.exports = CONFIG;
}
