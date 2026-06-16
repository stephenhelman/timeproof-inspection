export const ALLOWED_EMAIL_DOMAIN = "qntum.com";

export const ALLOWED_EMAIL_DOMAINS = [ALLOWED_EMAIL_DOMAIN, "scopereports.com"];

export const isWorkEmail = (email: string): boolean => {
  const normalized = email.toLowerCase().trim();
  return ALLOWED_EMAIL_DOMAINS.some((domain) => normalized.endsWith(`@${domain}`));
};

export const DEVICE_TOKEN_COOKIE = "tp_device_token";
export const DEVICE_TOKEN_EXPIRY_DAYS = 30;
export const TWO_FA_CODE_EXPIRY_MINUTES = 30;
