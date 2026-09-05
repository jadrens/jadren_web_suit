export const en = {
  nav: {
    start: "HOME",
    about: "ABOUT",
    blog: "BLOG",
    tools: "TOOLS",
    settings: "SETTINGS",
    account: "User center",
    userData: "User Data",
  },
  home: {
    title: "rayoumeu - Start",
    description: "Jadren's blog, tools, and projects",
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
      title: "LLM API", subtitle: "Local API profiles", profile: "Profile", name: "Name", renameHint: "Rename", type: "API type", token: "API token", url: "Base URL", urlHelp: "Enter a base URL or complete API endpoint", actualEndpoint: "Request endpoint", add: "Add profile", save: "Save profiles", delete: "Delete profile", empty: "No API profiles yet.", saved: "Profiles saved locally.",
      privacy: "By default, credentials stay only in this browser's localStorage. Cloud backup is optional and not recommended for API keys.",
      cloudWarning: "Not recommended: a cloud backup contains your API credentials. It is encrypted in this browser before upload, but no system can guarantee complete security. The server never receives your passphrase; losing it makes the backup unrecoverable.",
      cloudUpload: "Upload encrypted backup", cloudDownload: "Download encrypted backup", cloudTitleUpload: "Upload LLM settings", cloudTitleDownload: "Download LLM settings", cloudPassphrase: "Backup passphrase", cloudPassphraseHelp: "Use at least 6 characters. This is not your account password and is never uploaded.", cloudUploadConfirm: "Encrypt and upload", cloudDownloadConfirm: "Download and replace local settings", cloudLoginRequired: "Sign in with a verified account to use cloud backup.", cloudUploaded: "Encrypted backup uploaded.", cloudDownloaded: "Backup decrypted and saved locally.", cloudFailed: "Cloud backup failed: {error}", cloudWrongPassphrase: "The backup could not be decrypted. Check the passphrase.", cloudReplaceWarning: "This replaces the LLM settings currently stored in this browser.", cancel: "Cancel",
      unsaved: "You have unsaved settings. Are you sure you want to leave?",
      providerList: "Provider List", modelList: "Model List", provider: "Provider", model: "Model", modelId: "Model ID", addModel: "Add model", deleteModel: "Delete model", emptyModels: "No models yet.", providerRequired: "Add a provider before creating a model.", incompleteModel: "Incomplete models will not appear in tools. Select a provider and enter a Model ID.", modelAutoCompleteHelp: "Open to load models from the selected provider, or enter an ID manually.", loadingModels: "Loading models…", modelLoadFailed: "Could not load models: {error}. You can still enter an ID manually.", noModelsReturned: "The provider returned no models",
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
