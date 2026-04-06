export const ALLOWED_EMAIL_DOMAIN = "timeproofusa.com";

export const isWorkEmail = (email: string): boolean => {
  return email.toLowerCase().trim().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
};

export const DEVICE_TOKEN_COOKIE = "tp_device_token";
export const DEVICE_TOKEN_EXPIRY_DAYS = 30;
export const TWO_FA_CODE_EXPIRY_MINUTES = 30;
