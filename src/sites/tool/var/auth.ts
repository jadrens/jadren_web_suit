const AUTH_CONFIG = {
  verificationFromEmail: "auth@jadren.me",
  reminderFromEmail: "reminder@jadren.me",
  emailRateLimitDbPath: ".data/email-send-monitor.sqlite",
  loginRateLimitDbPath: ".data/login-attempt-monitor.sqlite",
} as const;

export default AUTH_CONFIG;
