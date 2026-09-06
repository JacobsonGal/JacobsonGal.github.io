const STORAGE_KEY = 'portfolio-publish-token';

export function getSessionPublishToken() {
  try {
    return sessionStorage.getItem(STORAGE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function setSessionPublishToken(token) {
  const value = String(token || '').trim();
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, value);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore quota / private mode failures
  }
  return value;
}

export function clearSessionPublishToken() {
  setSessionPublishToken('');
}

export function publishTokenSetupUrl() {
  return 'https://github.com/settings/personal-access-tokens/new';
}
