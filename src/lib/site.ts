// Page copy. Every fact here is taken from the corpus in /corpus (the CV-derived dataset) — nothing added.
// Contact links come from env vars and are only rendered when set, so nothing private is published by default.

export const site = {
  name: "Hassam Saleem",
  firstName: "Hassam",
  title: "Software Engineer",
  tagline: "Flutter mobile apps, MERN web apps, and AI-enabled features — speech, translation and real-time calling.",
  summary:
    "Hassam Saleem is a Software Engineer specializing in Flutter and Dart, with additional experience in MERN-stack web development and AI-enabled application features. His CV describes 2+ years of experience in Flutter mobile development and MERN development.",
  links: {
    // Public by Hassam's choice. Defaults live here so a missing env var on Vercel can't blank the contact section.
    linkedin: process.env.NEXT_PUBLIC_LINKEDIN_URL || "https://www.linkedin.com/in/hassam-saleem-b047b92a6",
    github: process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com/Hassam-Saleem",
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hassamsaleem310@gmail.com",
  },
};

export const experience = [
  {
    role: "Flutter App Developer",
    org: "NTIS PAK",
    period: "January 2026 – June 2026",
    points: [
      "Production Flutter applications with Firebase backends: Authentication, Cloud Firestore, Cloud Messaging, Cloud Functions and Firestore security rules.",
      "Bookings, interpreting workflows, maps and travel mode, invoices, notifications, and iOS / Android releases.",
      "Worked on AI-NTIS, an AI-enabled app with real-time calling and call translation.",
    ],
  },
  {
    role: "Flutter App Developer",
    org: "NSB Solutions",
    period: "January 2025 – December 2025",
    points: [
      "Built multiple production-level mobile applications from scratch.",
      "REST API integration, Provider and GetX state management, local storage.",
      "Google AdMob (Banner, Interstitial, Rewarded) with ad-placement optimization, plus performance refactoring.",
    ],
  },
  {
    role: "Software Developer Intern",
    org: "CodeAlpha",
    period: "June 2024 – September 2024",
    points: ["Developed scalable applications following SDLC practices, with debugging and performance optimization."],
  },
];

export const featuredProjects = [
  {
    name: "AI-NTIS",
    kind: "AI-enabled Flutter app · real-time calling & translation",
    blurb:
      "An AI-enabled mobile application built in the NTIS environment. Hassam worked on its mobile implementation and on the real-time communication and voice/translation functionality.",
    highlights: [
      "WebRTC (flutter_webrtc) for real-time calling and real-time call translation, including ICE candidate handling and buffering of pending ICE candidates.",
      "Speech-to-text, text-to-speech, audio recording/playback and ElevenLabs Agents for the voice workflow.",
      "Kotlin platform integration via Flutter MethodChannel, using Android AudioRecord and AudioTrack.",
      "AES-256-CBC encryption for chat and translated voice-note data.",
      "GetX for state management; Firebase Auth, Firestore, Cloud Messaging, Cloud Functions and security rules.",
    ],
    stack: ["Flutter", "Dart", "GetX", "WebRTC", "ElevenLabs Agents", "Kotlin", "Firebase"],
  },
  {
    name: "NTIS Pro",
    kind: "Production Flutter app · Firebase backend",
    blurb:
      "A production Flutter application in the NTIS environment. Hassam worked on its mobile development and production fixes — maintaining and extending an existing production app rather than a demo.",
    highlights: [
      "Bookings, interpreting services, maps, a travel mode, invoices and administrative workflows.",
      "Invoice preview and invoice amount calculation, password reset, booking/team queries.",
      "Firebase Cloud Messaging push notifications, including updates for users in different regions.",
      "Fixes and releases for both iOS and Android.",
    ],
    stack: ["Flutter", "Dart", "Firebase Auth", "Cloud Firestore", "Cloud Messaging", "Cloud Functions"],
  },
];

// Store links are Hassam's own; download counts and capabilities come from the CV-derived corpus.
export const liveApps = [
  {
    name: "Hello Translate — Chat & Voice",
    url: "https://play.google.com/store/apps/details?id=com.nsb.hellotranslate&hl=en",
    downloads: "1M+",
    blurb: "Multilingual translation with text and voice, real-time and offline translation, and PDF/document translation.",
  },
  {
    name: "PDF Reader",
    url: "https://play.google.com/store/apps/details?id=com.nsb.mobilepdf&hl=en",
    downloads: "500K+",
    blurb: "PDF reading and management with OCR, merge, split, compress and editing.",
  },
  {
    name: "QR Scanner Kit",
    url: "https://play.google.com/store/apps/details?id=com.qrscannerkit&hl=en",
    downloads: "10K+",
    blurb: "A QR scanning app from Hassam's published mobile portfolio.",
  },
  {
    name: "Screen Mirroring",
    url: "https://play.google.com/store/apps/details?id=com.nsb.screen_mirroring&hl=en",
    downloads: "10K+",
    blurb: "A screen mirroring app from Hassam's published mobile portfolio.",
  },
];

export const stats = [
  { value: "2+", label: "years in Flutter & MERN" },
  { value: "1M+", label: "Hello Translate downloads" },
  { value: "500K+", label: "PDF Reader downloads" },
];

export const skills: { group: string; items: string[] }[] = [
  { group: "Mobile", items: ["Flutter", "Dart", "Provider", "GetX", "Bloc", "Play Store & App Store deployment", "Google AdMob"] },
  { group: "Backend & data", items: ["Node.js", "Express.js", "REST APIs", "JWT", "MongoDB", "PostgreSQL", "Firebase / Firestore", "Cloud Functions"] },
  { group: "Real-time & AI", items: ["WebRTC", "WebSockets / Socket.io", "Speech-to-text", "Text-to-speech", "ElevenLabs Agents", "Kotlin MethodChannel"] },
  { group: "Tools", items: ["Git & GitHub", "Postman", "Android Studio", "VS Code", "Basic AWS"] },
];

export const education = {
  degree: "BS Computer Science",
  school: "University of Sindh",
  period: "January 2021 – December 2024",
  note: "CGPA 3.01 / 4.00",
};

export const suggestedQuestions = [
  "Did you work with WebRTC?",
  "What did you build at NTIS?",
  "Where do you work now?",
  "Have you worked at Google?",
];
