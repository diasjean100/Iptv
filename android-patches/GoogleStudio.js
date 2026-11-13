import {
  GOOGLE_IMAGE_MODELS, GOOGLE_VIDEO_MODELS, generateWithGoogle,
  mediaDataUrl, downloadGoogleVideo
} from '../lib/googleApi.js';

// Personal-use BYOK studio; never ship a private key inside the APK.
export function GoogleStudio() {
  const root = document.createElement('main');
  root.id = 'google-studio';
  root.className = 'w-full h-full overflow-y-auto custom-scrollbar bg-app-bg text-white px-4 py-5';
  root.style.cssText = 'overscroll-behavior:contain; -webkit-overflow-scrolling:touch;';
  const body = document.createElement('div');
  body.style.cssText = 'max-width:820px;margin:0 auto;padding-bottom:32px;display:flex;flex-direction:column;gap:16px;';
  root.appendChild(body);

  const el = (tag, text, css) => {
    const x = document.createElement(tag);
    if (text !== undefined) x.textContent = text;
    if (css) x.style.cssText = css;
    return x;
  };
  const label = (s) => el('label', s, 'display:block;font-size:13px;font-weight:700;margin-bottom:7px;');
  const fieldCss = 'width:100%;box-sizing:border-box;padding:13px;border:1px solid #444;background:#15151c;color:#fff;border-radius:12px;font-size:16px;';
  const panel = el('section', undefined, 'background:#12121b;border:1px solid #33313c;border-radius:18px;padding:16px;');
  const title = el('h1', 'Google IA · Gemini', 'font-size:23px;font-weight:800;margin:0;');
  const subtitle = el('p', 'Crie imagens, edite fotos e gere vídeos com sua própria chave do Google AI Studio.', 'font-size:13px;color:#bbb;line-height:1.5;margin:4px 0 0;');
  body.append(title, subtitle);
  const caution = el('p', 'Atenção: o uso da API pode consumir cotas ou gerar cobranças. Sua chave fica neste aparelho; para uso público, prefira um servidor que proteja as credenciais.', 'font-size:12px;line-height:1.5;color:#e4c38e;margin:0;');
  body.append(caution);

  const keyWrap = el('div');
  const keyLabel = label('Chave API do Google (Gemini)');
  const keyInput = el('input');
  keyInput.type = 'password';
  keyInput.placeholder = 'Cole sua chave do Google AI Studio';
  keyInput.autocomplete = 'off';
  keyInput.spellcheck = false;
  keyInput.style.cssText = fieldCss;
  keyInput.value = localStorage.getItem('google_gemini_key') || sessionStorage.getItem('google_gemini_key') || '';
  const remember = el('input');
  remember.type = 'checkbox';
  remember.checked = !!localStorage.getItem('google_gemini_key');
  const rememberLabel = el('label', undefined, 'display:flex;align-items:center;gap:8px;font-size:12px;color:#ccc;margin-top:10px;');
  rememberLabel.append(remember, document.createTextNode('Lembrar chave neste aparelho (armazenamento local, não criptografado)'));
  const clearKey = el('button', 'Apagar chave', 'border:0;background:transparent;color:#fbb;cursor:pointer;font-size:12px;text-decoration:underline;padding:8px 0;');
  const keyLink = el('a', 'Criar chave no Google AI Studio', 'color:#a8c7fa;font-size:12px;display:inline-block;margin-left:12px;');
  keyLink.href = 'https://aistudio.google.com/api-keys'; keyLink.target = '_blank'; keyLink.rel = 'noopener noreferrer';
  keyWrap.append(keyLabel, keyInput, rememberLabel, clearKey, keyLink);
  panel.append(keyWrap);
  body.append(panel);
  const persistKey = () => {
    const key = keyInput.value.trim();
    sessionStorage.removeItem('google_gemini_key');
    localStorage.removeItem('google_gemini_key');
    if (key) (remember.checked ? localStorage : sessionStorage).setItem('google_gemini_key', key);
  };
  keyInput.addEventListener('change', persistKey);
  remember.addEventListener('change', persistKey);
  clearKey.addEventListener('click', () => {
    keyInput.value = '';
    sessionStorage.removeItem('google_gemini_key');
    localStorage.removeItem('google_gemini_key');
    setStatus('Chave apagada.');
  });

  const form = el('section', undefined, 'background:#12121b;border:1px solid #33313c;border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:14px;');
  body.append(form);
  const selectRow = (caption, options) => {
    const wrap = el('div'); wrap.append(label(caption));
    const sel = el('select'); sel.style.cssText = fieldCss;
    options.forEach(([v,t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.append(o); });
    wrap.append(sel); form.append(wrap); return sel;
  };
  const kind = selectRow('O que você quer fazer?', [['image','Gerar / editar imagem'],['video','Gerar vídeo']]);
  const models = selectRow('Modelo Google', GOOGLE_IMAGE_MODELS.map(m=>[m.id,m.label]));
  const ratio = selectRow('Formato', [['1:1','Quadrado 1:1'],['9:16','Vertical 9:16'],['16:9','Horizontal 16:9'],['4:3','Paisagem 4:3'],['3:4','Retrato 3:4']]);
  const size = selectRow('Qualidade da imagem', [['1K','1K · econômica'],['2K','2K'],['4K','4K · pode custar mais']]);
  const promptWrap = el('div'); promptWrap.append(label('Descrição'));
  const prompt = el('textarea'); prompt.style.cssText = fieldCss + 'min-height:120px;resize:vertical;'; prompt.placeholder = 'Ex.: Um pôr do sol no Cerrado, fotografia realista, luz dourada…';
  promptWrap.append(prompt); form.append(promptWrap);

  const imgWrap = el('div'); imgWrap.append(label('Foto de referência (opcional, para editar ou animar)'));
  const picker = el('input'); picker.type='file'; picker.accept='image/png,image/jpeg,image/webp'; picker.style.cssText='display:block;width:100%;font-size:13px;';
  const preview = el('img'); preview.alt='Imagem selecionada'; preview.style.cssText='display:none;width:110px;max-height:110px;object-fit:contain;margin-top:8px;border-radius:10px;';
  imgWrap.append(picker,preview); form.append(imgWrap);
  picker.addEventListener('change',()=>{
    if(picker.files?.[0]){ preview.src = URL.createObjectURL(picker.files[0]); preview.style.display='block'; }
    else { preview.removeAttribute('src');preview.style.display='none'; }
  });

  const button = el('button','Gerar com Google IA', 'width:100%;background:#a8c7fa;color:#161b27;border:0;border-radius:14px;font-size:16px;font-weight:800;padding:15px;cursor:pointer;');
  const status = el('p', '', 'font-size:13px;color:#b8c1d1;white-space:pre-wrap;overflow-wrap:anywhere;margin:0;');
  const setStatus = (s, bad=false) => { status.textContent = s; status.style.color = bad?'#ffabab':'#b8c1d1'; };
  form.append(button,status);
  const resultPanel = el('section', undefined, 'display:none;background:#12121b;border:1px solid #33313c;border-radius:18px;padding:16px;');
  const resultTitle = el('h2', 'Resultado', 'font-size:18px;font-weight:700;margin:0 0 12px;');
  const mediaSlot = el('div'); mediaSlot.style.cssText='width:100%;min-height:60px;';
  const download = el('a','Baixar resultado', 'display:inline-block;margin-top:12px;padding:12px 17px;border-radius:12px;background:#71c7a3;color:#10241b;font-size:14px;font-weight:800;text-decoration:none;');
  resultPanel.append(resultTitle,mediaSlot,download); body.append(resultPanel);

  const updateKind = () => {
    const isVideo = kind.value==='video';
    const options = isVideo ? GOOGLE_VIDEO_MODELS : GOOGLE_IMAGE_MODELS;
    models.replaceChildren();
    options.forEach(m=>{ const option=el('option',m.label);option.value=m.id;models.append(option); });
    ratio.replaceChildren();
    (isVideo ? [['16:9','Horizontal 16:9'],['9:16','Vertical 9:16']] : [['1:1','Quadrado 1:1'],['9:16','Vertical 9:16'],['16:9','Horizontal 16:9'],['4:3','Paisagem 4:3'],['3:4','Retrato 3:4']])
      .forEach(([v,t])=>{const option=el('option',t);option.value=v;ratio.append(option);});
    size.parentElement.style.display=isVideo?'none':'';
    button.textContent=isVideo?'Gerar vídeo com Google':'Gerar imagem com Google';
  };
  kind.addEventListener('change',updateKind); updateKind();

  let activeObjectUrl=null;
  async function imageToBase64(file){
    if(file.size>8*1024*1024) throw new Error('Escolha uma imagem de até 8 MB.');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Use uma imagem JPG, PNG ou WebP.');
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=()=>reject(new Error('Não foi possível ler a imagem.'));
      reader.onload=()=>resolve({mime_type:file.type,data:String(reader.result).split(',')[1]});
      reader.readAsDataURL(file);
    });
  }
  button.addEventListener('click',async()=>{
    if(!keyInput.value.trim()) {setStatus('Informe primeiro sua chave API do Google.',true);keyInput.focus();return;}
    if(!prompt.value.trim()){setStatus('Descreva o que deseja criar.',true);prompt.focus();return;}
    button.disabled=true;button.style.opacity='.5';resultPanel.style.display='none';
    try{
      persistKey();
      const file=picker.files?.[0];
      const images=file?[await imageToBase64(file)]:[];
      const response=await generateWithGoogle({
        kind:kind.value,model:models.value,prompt:prompt.value,images,ratio:ratio.value,size:size.value,apiKey:keyInput.value.trim()
      },fetch,s=>setStatus(s));
      if(activeObjectUrl){URL.revokeObjectURL(activeObjectUrl);activeObjectUrl=null;}
      mediaSlot.replaceChildren();
      let media,url;
      const isVideo=kind.value==='video';
      if(isVideo){
        const blob=await downloadGoogleVideo(response,keyInput.value.trim(),fetch,s=>setStatus(s));
        activeObjectUrl=URL.createObjectURL(blob);
        url=activeObjectUrl;
        media=el('video');media.controls=true;media.playsInline=true;media.preload='metadata';
        media.src=url;
      }else {
        url=mediaDataUrl(response);
        media=el('img');media.alt='Imagem gerada pelo Google';media.src=url;
      }
      media.style.cssText='display:block;width:100%;max-height:600px;object-fit:contain;border-radius:12px;background:#08080c;';
      mediaSlot.append(media);
      download.href=url;
      download.download=isVideo?'gemini-video.mp4':(response.mimeType==='image/jpeg'?'gemini-imagem.jpg':'gemini-imagem.png');
      resultPanel.style.display='block';
      setStatus('Resultado recebido. Use Baixar resultado para salvar.');
    }catch(error){
      let message=String(error?.message||'Erro desconhecido.');
      if(/Failed to fetch|NetworkError|CORS/i.test(message))message+=' Verifique sua conexão e a permissão de rede do aplicativo.';
      if(/403|permission|unauthenticated|401/i.test(message))message+=' Confira sua chave e o acesso do projeto aos modelos.';
      if(/429|quota|RESOURCE_EXHAUSTED/i.test(message))message+=' Pode ser necessário aguardar ou habilitar faturamento.';
      setStatus(message,true);
    }finally{button.disabled=false;button.style.opacity='1';}
  });
  return root;
}
