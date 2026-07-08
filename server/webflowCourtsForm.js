import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FALLBACK_CONFIG = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'webflowCourtsFormConfig.json'), 'utf8')
);

const CONFIG_CACHE_TTL_MS = 1000 * 60 * 30;

let cachedConfig = null;
let cacheExpiresAt = 0;

function getEnv() {
  return {
    siteId: (process.env.WEBFLOW_SITE_ID || FALLBACK_CONFIG.siteId || '').trim(),
    formName: (process.env.WEBFLOW_FORM_NAME || FALLBACK_CONFIG.formName || 'Courts Form').trim(),
    pageId: (process.env.WEBFLOW_PAGE_ID || FALLBACK_CONFIG.pageId || '').trim(),
    apiToken: (process.env.WEBFLOW_API_TOKEN || '').trim(),
  };
}

function normalizeField(field) {
  const name = (field?.name || field?.slug || field?.id || '').trim();
  if (!name) return null;

  const rawType = String(field?.type || field?.fieldType || 'text').toLowerCase();
  let type = 'text';
  if (rawType.includes('email')) type = 'email';
  else if (rawType.includes('phone') || rawType.includes('tel')) type = 'tel';
  else if (rawType.includes('textarea') || rawType.includes('multiline')) type = 'textarea';

  const fallback = FALLBACK_CONFIG.fields.find((f) => f.name === name);
  return {
    name,
    type,
    required: Boolean(field?.required ?? field?.isRequired ?? fallback?.required),
    labelKey: fallback?.labelKey || null,
    label: (field?.label || field?.displayName || fallback?.label || name).trim(),
  };
}

function mapApiFormToConfig(form, env) {
  const fields = Array.isArray(form?.fields)
    ? form.fields.map(normalizeField).filter(Boolean)
    : [];

  return {
    siteId: env.siteId,
    pageId: env.pageId,
    formName: form?.displayName || form?.name || env.formName,
    formId: form?.id || FALLBACK_CONFIG.formId,
    fields: fields.length ? fields : FALLBACK_CONFIG.fields,
    source: 'webflow-api',
  };
}

async function fetchFormConfigFromApi(env) {
  if (!env.apiToken || !env.siteId) return null;

  const res = await fetch(`https://api.webflow.com/v2/sites/${env.siteId}/forms`, {
    headers: {
      Authorization: `Bearer ${env.apiToken}`,
      accept: 'application/json',
      'accept-version': '2.0.0',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Webflow forms API ${res.status}: ${body || res.statusText}`);
  }

  const data = await res.json();
  const forms = Array.isArray(data?.forms) ? data.forms : [];
  const targetName = env.formName.toLowerCase();
  const form = forms.find((item) => {
    const displayName = String(item?.displayName || '').toLowerCase();
    const name = String(item?.name || '').toLowerCase();
    return displayName === targetName || name === targetName;
  }) || forms[0];

  if (!form) return null;
  return mapApiFormToConfig(form, env);
}

export async function getCourtsFormConfig() {
  const env = getEnv();
  const now = Date.now();

  if (cachedConfig && cacheExpiresAt > now) {
    return cachedConfig;
  }

  let config = {
    siteId: env.siteId,
    pageId: env.pageId,
    formName: env.formName,
    formId: FALLBACK_CONFIG.formId,
    fields: FALLBACK_CONFIG.fields,
    source: 'static',
  };

  if (env.apiToken) {
    try {
      const apiConfig = await fetchFormConfigFromApi(env);
      if (apiConfig) config = apiConfig;
    } catch (err) {
      console.warn('Webflow courts form config API failed, using static fallback:', err.message);
    }
  }

  cachedConfig = config;
  cacheExpiresAt = now + CONFIG_CACHE_TTL_MS;
  return config;
}

export async function submitCourtsForm(inputFields) {
  const env = getEnv();
  if (!env.siteId) {
    throw new Error('WEBFLOW_SITE_ID is not configured');
  }

  const config = await getCourtsFormConfig();
  const allowedNames = new Set(config.fields.map((field) => field.name));
  const payload = {};

  for (const [key, value] of Object.entries(inputFields || {})) {
    if (!allowedNames.has(key)) continue;
    if (value == null) continue;
    const trimmed = String(value).trim();
    if (!trimmed) continue;
    payload[key] = trimmed;
  }

  for (const field of config.fields) {
    if (!field.required) continue;
    if (!payload[field.name]) {
      throw new Error(`Missing required field: ${field.label || field.name}`);
    }
  }

  const formData = new FormData();
  formData.append('name', config.formName);
  if (env.pageId) formData.append('pageId', env.pageId);
  for (const [key, value] of Object.entries(payload)) {
    formData.append(key, value);
  }

  const res = await fetch(`https://webflow.com/api/v1/form/${env.siteId}`, {
    method: 'POST',
    body: formData,
    headers: {
      Accept: 'application/json',
    },
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message = typeof data === 'object' && data?.msg
      ? data.msg
      : typeof data === 'string' && data
        ? data
        : `Webflow form submit failed (${res.status})`;
    throw new Error(message);
  }

  return {
    ok: true,
    data,
  };
}
