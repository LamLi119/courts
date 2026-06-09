/** Strip dial code from phone_no when stored or pasted as E.164 (e.g. 85291234567). */
export function normalizePhoneFields(phoneNo: string, countryCode = '852') {
  const countryCodeDigits = (countryCode || '852').replace(/\D/g, '') || '852';
  let phoneDigits = (phoneNo || '').replace(/\D/g, '');
  if (countryCodeDigits && phoneDigits.startsWith(countryCodeDigits)) {
    phoneDigits = phoneDigits.slice(countryCodeDigits.length);
  }
  return { phoneNo: phoneDigits, countryCode: countryCodeDigits };
}

/** True when user has a local number only (matches IntlTelInput 6–15 digit rule). */
export function hasLocalPhoneOnly(phoneNo?: string, countryCode?: string): boolean {
  const raw = (phoneNo || '').replace(/\D/g, '');
  if (!raw) return false;
  const { phoneNo: local } = normalizePhoneFields(phoneNo || '', countryCode || '852');
  return local.length >= 6 && local.length <= 15;
}

/** Whether phone_no still includes the dial code prefix (needs repair in DB). */
export function phoneIncludesDialCode(phoneNo?: string, countryCode?: string): boolean {
  const raw = (phoneNo || '').replace(/\D/g, '');
  if (!raw) return false;
  const { phoneNo: local } = normalizePhoneFields(phoneNo || '', countryCode || '852');
  return raw !== local;
}
