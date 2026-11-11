const AUTH_CONFIG = {
  verificationFromEmail: "Jadren <no-reply@jadren.me>",
  reminderFromEmail: "Jadren Reminder <auto@jadren.me>",
  emailRateLimitDbPath: ".data/email-send-monitor.sqlite",
  loginRateLimitDbPath: ".data/login-attempt-monitor.sqlite",
} as const;

export default AUTH_CONFIG;
