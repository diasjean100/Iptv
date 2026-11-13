// Google Gemini BYOK client for the personal Android build.
// No key is bundled. The user enters a key locally at runtime.
export const GOOGLE_IMAGE_MODELS = Object.freeze([
  { id: 'gemini-3.1-flash-image', label: 'Nano Banana 2 (rápido)' },
  { id: 'gemini-3.1-flash-lite-image', label: 'Nano Banana 2 Lite (econômico)' },
  { id: 'gemini-3-pro-image', label: 'Nano Banana Pro (qualidade)' },
  { id: 'gemini-2.5-flash-image', label: 'Nano Banana (anterior)' }
]);
export const GOOGLE_VIDEO_MODELS = Object.freeze([
  { id: 'gemini-omni-1.2-flash', label: 'Gemini Omni Flash (vídeo)' }
]);
export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';

export function buildGooglePayload({ kind, model, prompt, images = [], ratio = '1:1', size = '1K' }) {
  const video = kind === 'video';
  const allowed = video ? GOOGLE_VIDEO_MODELS : GOOGLE_IMAGE_MODELS;
  if (!allowed.some(item => item.id === model)) throw new Error('Modelo Google não suportado.');
  if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('Digite uma descrição para gerar.');
  if (!Array.isArray(images) || images.length > 1) throw new Error('Selecione no máximo uma imagem.');
  const inputs = images.map(image => {
    if (!image || !/^(image\/png|image\/jpeg|image\/webp)$/.test(image.mime_type) || !/^[A-Za-z0-9+/]+=*$/.test(image.data || '')) {
      throw new Error('A imagem precisa estar em PNG, JPEG ou WebP.');
    }
    return { type: 'image', mime_type: image.mime_type, data: image.data };
  });
  inputs.push({ type: 'text', text: prompt.trim() });
  if (video) {
    if (!['16:9', '9:16'].includes(ratio)) throw new Error('Formato de vídeo inválido.');
    return {
      model,
      input: inputs,
      response_format: { type: 'video', aspect_ratio: ratio, resolution: '720p', delivery: 'uri' }
    };
  }
  if (!['1:1', '16:9', '9:16', '4:3', '3:4'].includes(ratio)) throw new Error('Formato de imagem inválido.');
  const response_format = { type: 'image', aspect_ratio: ratio };
  // Legacy Nano Banana has a fixed output size; omit unsupported image_size.
  if (model !== 'gemini-2.5-flash-image') response_format.image_size = ['1K', '2K', '4K'].includes(size) ? size : '1K';
  return { model, input: inputs, response_format };
}

function responseMessage(obj, fallback) {
  const error = obj?.error;
  if (!error) return fallback;
  return typeof error === 'string' ? error : (error.message || fallback);
}

export function extractGoogleOutput(result, kind) {
  const obj = result?.interaction || result || {};
  const content = (obj.steps || [])
    .filter(step => step.type === 'model_output')
    .flatMap(step => step.content || []);
  const expected = kind === 'video' ? 'video' : 'image';
  const output = content.find(item => item.type === expected && (item.data || item.uri)) ||
    content.find(item => item.type === expected && item.inline_data?.data);
  const legacy = kind === 'video' ? obj.output_video : obj.output_image;
  const block = output || legacy;
  if (!block) throw new Error('O Google não retornou a mídia solicitada. Verifique se a geração foi permitida.');
  return {
    mimeType: block.mime_type || block.mimeType || block.inline_data?.mime_type || (kind === 'video' ? 'video/mp4' : 'image/png'),
    base64: block.data || block.inline_data?.data || null,
    uri: block.uri || null,
    interactionId: obj.id || null
  };
}

async function parseResponse(res) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : {}; }
  catch { throw new Error('O Google respondeu em um formato inesperado.'); }
}

export async function generateWithGoogle(options, requester = fetch, onProgress = () => {}) {
  const apiKey = String(options.apiKey || '').trim();
  if (!apiKey) throw new Error('Informe sua chave da API do Google.');
  const payload = buildGooglePayload(options);
  const headers = {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
    'Api-Revision': '2026-05-20'
  };
  onProgress('Enviando solicitação ao Google…');
  let res = await requester(GEMINI_ENDPOINT, { method: 'POST', headers, body: JSON.stringify(payload) });
  let response = await parseResponse(res);
  if (!res.ok || response.error) {
    const code = res.status;
    throw new Error(responseMessage(response, 'Erro do Google (' + code + '). Verifique sua chave, cota e acesso ao modelo.'));
  }
  let value = response.interaction || response;
  const createdId = value.id;
  let attempts = 0;
  while (value.status && !['completed', 'succeeded', 'failed', 'cancelled'].includes(value.status.toLowerCase())) {
    if (!createdId || attempts++ >= 36) throw new Error('A geração não terminou durante a consulta. Confira seu saldo antes de tentar de novo.');
    onProgress('Processando no Google… ' + (attempts * 5) + ' s');
    await new Promise(resolve => setTimeout(resolve, 5000));
    res = await requester(GEMINI_ENDPOINT + '/' + encodeURIComponent(createdId), { method: 'GET', headers });
    response = await parseResponse(res);
    if (!res.ok || response.error) throw new Error(responseMessage(response, 'Falha ao consultar a geração.'));
    value = response.interaction || response;
  }
  if (['failed','cancelled'].includes(String(value.status || '').toLowerCase())) {
    throw new Error(responseMessage(value, 'A geração foi interrompida pelo Google.'));
  }
  onProgress('Preparando a mídia…');
  return extractGoogleOutput(value, options.kind);
}

export function makeSafeGoogleDownloadUrl(uri) {
  const url = new URL(uri);
  if (url.protocol !== 'https:' || url.hostname !== 'generativelanguage.googleapis.com') {
    throw new Error('O Google retornou um endereço de download não permitido.');
  }
  return url.toString();
}
