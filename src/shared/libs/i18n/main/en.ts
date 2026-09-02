export const en = {
  nav: {
    start: "START",
    blog: "BLOG",
    tools: "TOOLS",
    settings: "SETTINGS",
    account: "User center",
  },
  home: {
    title: "rayoumeu - Start",
    description: "Start page for jadren",
  },
  blogPortal: {
    title: "My Blog",
    description:
      "A personal blog built with Next.js, featuring Markdown & LaTeX support, code syntax highlighting, and bilingual content.",
    features: [
      "Markdown & LaTeX",
      "Code Highlighting",
      "Dark / Light Theme",
      "Full-text Search",
    ],
    visit: "Visit blog",
  },
  theme: {
    toggle: "Toggle theme",
  },
  settings: {
    title: "Settings", description: "Manage preferences stored locally in this browser.",
    automatic: "Automatic (sunrise and sunset)", system: "Follow system", manual: "Manually",
    location: "Location", locationHelp: "Enter coordinates, use website location, or estimate them from the current IP.",
    latitude: "Latitude", longitude: "Longitude", save: "Save coordinates", useLocation: "Use website location", useIp: "Use current IP", source: "Location source",
    sources: { manual: "entered manually", geolocation: "website location", ip: "current IP" },
    saved: "Location saved and today's times calculated.", invalid: "Enter valid latitude and longitude.", locationFailed: "Location could not be retrieved. Check site permission.", ipFailed: "Coordinates could not be retrieved from the current IP.",
    solar: "Today: sunrise {sunrise}, sunset {sunset}. This is recalculated tomorrow.",
    llm: {
      title: "LLM API", subtitle: "Local API profiles", profile: "Profile", name: "Name", renameHint: "Double-click to rename", type: "API type", token: "API token", url: "Base URL", urlHelp: "Enter a base URL or complete API endpoint", actualEndpoint: "Request endpoint", add: "Add profile", save: "Save profiles", delete: "Delete profile", empty: "No API profiles yet.", saved: "Profiles saved locally.",
      privacy: "Your credentials are stored only in this browser's localStorage. This project is open source and does not upload or steal your credentials.",
      unsaved: "You have unsaved settings. Are you sure you want to leave?",
      providerList: "Provider List", modelList: "Model List", provider: "Provider", model: "Model", modelId: "Model ID", addModel: "Add model", deleteModel: "Delete model", emptyModels: "No models yet.", providerRequired: "Add a provider before creating a model.",
    },
  },
  stylizedName: {
    part1: "Jadren ",
    part2: "Rayne",
  },
  toolPortal: {
    title: "Online Tools",
    description:
      "A collection of useful online tools — Base64 encode/decode, with more utilities on the way.",
    features: [
      "Base64 Encoder/Decoder",
      "Fast & Offline-capable",
      "Dark / Light Theme",
      "More Tools Coming",
    ],
    visit: "Visit tools",
  },
  footer: {
    copyright: "jadren",
    email: "jaden@jadren.me",
    github: "GitHub",
    beian: "豫ICP备2023022865号",
  },
};

export type TranslationKeys = typeof en;
