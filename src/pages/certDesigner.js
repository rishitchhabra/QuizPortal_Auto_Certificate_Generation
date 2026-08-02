import { saveCertTemplate, getCertTemplate, generateId } from '../store.js';
import { renderNavbar, showToast, escapeHtml } from '../utils.js';
import { requireAdmin } from '../auth.js';

let template = null;
let selectedId = null;
let previewObjectUrl = null;

export async function renderCertDesigner(app, params) {
  if (!requireAdmin()) return;

  if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null; }

  const id = params[0];
  if (id && id !== 'new') {
    template = await getCertTemplate(id);
    if (!template) { window.location.hash = '#/admin'; return; }
  } else {
    template = defaultTemplate();
  }
  selectedId = null;
  renderPage(app);
}

function defaultTemplate() {
  return {
    id: generateId(),
    name: 'Official Certificate Template',
    backgroundImage: '',
    elements: [
      { id: generateId(), type: 'text', content: 'CERTIFICATE OF ACHIEVEMENT', x: 50, y: 110, fontSize: 26, color: '#0284c7', fontFamily: "'Playfair Display',serif", fontWeight: '700', textAlign: 'center', width: 800 },
      { id: generateId(), type: 'text', content: '{{quiz_title}}', x: 50, y: 165, fontSize: 24, color: '#1e293b', fontFamily: "'Playfair Display',serif", fontWeight: '700', textAlign: 'center', width: 800 },
      { id: generateId(), type: 'text', content: 'PROUDLY PRESENTED TO', x: 50, y: 220, fontSize: 13, color: '#64748b', fontFamily: "'Outfit',sans-serif", fontWeight: '600', textAlign: 'center', width: 800 },
      { id: generateId(), type: 'text', content: '{{name}}', x: 50, y: 255, fontSize: 36, color: '#d97706', fontFamily: "'Great Vibes',cursive", fontWeight: '700', textAlign: 'center', width: 800 },
      { id: generateId(), type: 'text', content: 'for successfully completing the evaluation with a score of {{score}}/{{total}} ({{percent}})', x: 50, y: 330, fontSize: 14, color: '#475569', fontFamily: "'Outfit',sans-serif", fontWeight: '400', textAlign: 'center', width: 800 },
      { id: generateId(), type: 'text', content: 'Date: {{date}}', x: 100, y: 460, fontSize: 13, color: '#64748b', fontFamily: "'Outfit',sans-serif", fontWeight: '500', textAlign: 'center', width: 250 },
      { id: generateId(), type: 'text', content: '_______________________\nAuthorized Signature', x: 550, y: 445, fontSize: 13, color: '#64748b', fontFamily: "'Outfit',sans-serif", fontWeight: '500', textAlign: 'center', width: 250 }
    ],
    createdAt: new Date().toISOString()
  };
}

function renderPage(app) {
  if (!template.elements) template.elements = [];
  const sel = selectedId ? template.elements.find(e => e.id === selectedId) : null;
  const hasUpload = !!template.backgroundImage || !!previewObjectUrl;

  const sampleValues = {
    '{{name}}': 'Rishit Singh Chhabra',
    '{{quiz_title}}': 'General Science Evaluation',
    '{{score}}': '20',
    '{{total}}': '20',
    '{{percent}}': '100%',
    '{{date}}': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    '{{email}}': 'student@gyan.edu',
    '{{org}}': 'Class 10-A'
  };

  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container" style="max-width: 1200px; margin-top: 1.5rem; margin-bottom: 4rem">

        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; flex-wrap:wrap; gap: 1rem">
          <div>
            <a href="#/admin" class="btn btn-ghost btn-sm" style="margin-bottom: 0.4rem">← Back to Admin Portal</a>
            <h1 style="font-size: 1.6rem; font-weight: 900">🎓 Certificate Template Designer & Upload</h1>
            <p style="color: var(--text-sub); font-size: 0.85rem; margin-top: 0.2rem">
              Upload custom background graphics and position dynamic text placeholders ({{name}}, {{quiz_title}}, {{score}}, {{date}}).
            </p>
          </div>
          <div style="display:flex; gap: 0.5rem">
            <button class="btn btn-secondary btn-sm" id="btn-add-placeholder">+ Add Text Block</button>
            <button class="btn btn-primary" id="btn-save">💾 Save Template</button>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 360px 1fr; gap: 1.5rem">
          
          <!-- LEFT SIDEBAR: Upload + Element Controls + Placeholders Guide -->
          <div style="display:flex; flex-direction:column; gap: 1.25rem">
            
            <!-- 1. Template Name -->
            <div class="clay-card">
              <h3 style="font-size: 1rem; font-weight: 800; margin-bottom: 0.75rem">📝 Template Name</h3>
              <input type="text" class="form-input" id="tmpl-name" value="${escapeHtml(template.name)}" placeholder="e.g. Science Quiz Achievement Certificate" style="font-weight: 700">
            </div>

            <!-- 2. Upload Background Graphic -->
            <div class="clay-card">
              <h3 style="font-size: 1rem; font-weight: 800; margin-bottom: 0.5rem">📄 Upload Background Design</h3>
              <p style="font-size: 0.78rem; color: var(--text-sub); margin-bottom: 1rem">
                Upload your custom graphic/border (PNG, JPG, WebP). Placeholders below will overlay on top.
              </p>

              <div style="border: 2px dashed ${hasUpload ? 'var(--clay-success)' : 'rgba(160,195,230,0.5)'}; border-radius: var(--radius-md); padding: 1.25rem; text-align:center; background: ${hasUpload ? 'rgba(34,197,94,0.05)' : 'var(--bg-input)'}; cursor: pointer; transition: all 0.2s" id="upload-drop-zone">
                ${hasUpload ? `
                  <div style="font-size: 2rem; margin-bottom: 0.2rem">✅</div>
                  <div style="font-weight: 800; color: var(--clay-success); font-size:0.9rem">Background Uploaded</div>
                  <div style="font-size: 0.75rem; color: var(--text-sub)">Click to replace image</div>
                ` : `
                  <div style="font-size: 2rem; margin-bottom: 0.2rem">📤</div>
                  <div style="font-weight: 800; font-size:0.9rem">Upload Background Graphic</div>
                  <div style="font-size: 0.75rem; color: var(--text-sub)">Click or drop image file here</div>
                `}
                <input type="file" id="cert-upload" accept="image/png,image/jpeg,image/webp,image/jpg" style="display:none">
              </div>

              ${hasUpload ? `
                <button class="btn btn-danger btn-sm" id="btn-remove-upload" style="width: 100%; margin-top: 0.6rem; font-size:0.8rem">🗑️ Remove Uploaded Background</button>
              ` : ''}
            </div>

            <!-- 3. Active Element Property Controls -->
            ${sel ? `
              <div class="clay-card" style="border: 2px solid var(--clay-primary)">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.75rem">
                  <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--clay-primary); margin:0">
                    ✏️ Edit Text Block
                  </h3>
                  <button class="btn btn-danger btn-sm del-el" data-elid="${sel.id}" style="padding:0.15rem 0.4rem; font-size:0.75rem">🗑️ Remove</button>
                </div>
                
                <div class="form-group" style="margin-bottom: 0.6rem">
                  <label class="form-label" style="font-size:0.78rem">Text / Placeholder Content</label>
                  <input type="text" class="form-input" id="prop-content" value="${escapeHtml(sel.content)}" style="font-size:0.85rem">
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.6rem">
                  <div class="form-group" style="margin:0">
                    <label class="form-label" style="font-size:0.78rem">Font Size (px)</label>
                    <input type="number" class="form-input" id="prop-fs" value="${sel.fontSize || 16}" style="font-size:0.85rem">
                  </div>
                  <div class="form-group" style="margin:0">
                    <label class="form-label" style="font-size:0.78rem">Text Color</label>
                    <input type="color" class="form-input" id="prop-color" value="${sel.color || '#333333'}" style="height:35px; padding:2px">
                  </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.6rem">
                  <div class="form-group" style="margin:0">
                    <label class="form-label" style="font-size:0.78rem">Font Family</label>
                    <select class="form-select" id="prop-font" style="font-size:0.8rem">
                      <option value="'Playfair Display',serif" ${sel.fontFamily?.includes('Playfair') ? 'selected' : ''}>Playfair Display (Serif)</option>
                      <option value="'Great Vibes',cursive" ${sel.fontFamily?.includes('Great') ? 'selected' : ''}>Great Vibes (Cursive)</option>
                      <option value="'Outfit',sans-serif" ${sel.fontFamily?.includes('Outfit') ? 'selected' : ''}>Outfit (Sans-Serif)</option>
                      <option value="'Inter',sans-serif" ${sel.fontFamily?.includes('Inter') ? 'selected' : ''}>Inter (Modern)</option>
                    </select>
                  </div>
                  <div class="form-group" style="margin:0">
                    <label class="form-label" style="font-size:0.78rem">Align</label>
                    <select class="form-select" id="prop-align" style="font-size:0.8rem">
                      <option value="center" ${sel.textAlign === 'center' ? 'selected' : ''}>Center</option>
                      <option value="left" ${sel.textAlign === 'left' ? 'selected' : ''}>Left</option>
                      <option value="right" ${sel.textAlign === 'right' ? 'selected' : ''}>Right</option>
                    </select>
                  </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem">
                  <div class="form-group" style="margin:0">
                    <label class="form-label" style="font-size:0.75rem">X (px)</label>
                    <input type="number" class="form-input" id="prop-x" value="${sel.x}" style="font-size:0.8rem">
                  </div>
                  <div class="form-group" style="margin:0">
                    <label class="form-label" style="font-size:0.75rem">Y (px)</label>
                    <input type="number" class="form-input" id="prop-y" value="${sel.y}" style="font-size:0.8rem">
                  </div>
                  <div class="form-group" style="margin:0">
                    <label class="form-label" style="font-size:0.75rem">Width (px)</label>
                    <input type="number" class="form-input" id="prop-w" value="${sel.width || 800}" style="font-size:0.8rem">
                  </div>
                </div>
              </div>
            ` : `
              <div class="clay-card" style="background:#f8fafc; text-align:center; padding:1.25rem">
                <div style="font-size:0.85rem; color:var(--text-sub)">Click any text element on the canvas to edit its position, font size, or color.</div>
              </div>
            `}

            <!-- 4. Text Blocks List -->
            <div class="clay-card">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.6rem">
                <h3 style="font-size: 0.95rem; font-weight: 800">📝 Dynamic Text Blocks</h3>
                <button class="btn btn-secondary btn-sm" id="btn-add-text" style="font-size:0.75rem; padding:0.2rem 0.5rem">+ Add Block</button>
              </div>
              <div style="display:flex; flex-direction:column; gap: 0.4rem; max-height: 200px; overflow-y:auto">
                ${template.elements.map(e => `
                  <div class="layer-item ${e.id === selectedId ? 'active' : ''}" data-elid="${e.id}" style="display:flex; justify-content:space-between; align-items:center; padding: 0.4rem 0.6rem; background: ${e.id === selectedId ? '#e0f2fe' : '#fff'}; border-radius:var(--radius-sm); cursor:pointer; font-size:0.8rem">
                    <span style="font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width: 220px">
                      ${escapeHtml(e.content)}
                    </span>
                    <span style="font-size:0.7rem; color:var(--text-sub)">(${e.x}, ${e.y})</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- 5. Placeholders Reference Guide -->
            <div class="clay-card" style="background: linear-gradient(135deg, #f0f9ff, #f8fafc)">
              <h3 style="font-size: 0.95rem; font-weight: 800; margin-bottom: 0.4rem; color: var(--clay-primary)">
                📌 Available Dynamic Tags
              </h3>
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.35rem; font-size: 0.78rem">
                <div style="padding:0.25rem 0.4rem; background:#fff; border-radius:4px"><code>{{name}}</code></div>
                <div style="padding:0.25rem 0.4rem; background:#fff; border-radius:4px"><code>{{quiz_title}}</code></div>
                <div style="padding:0.25rem 0.4rem; background:#fff; border-radius:4px"><code>{{score}}</code></div>
                <div style="padding:0.25rem 0.4rem; background:#fff; border-radius:4px"><code>{{total}}</code></div>
                <div style="padding:0.25rem 0.4rem; background:#fff; border-radius:4px"><code>{{percent}}</code></div>
                <div style="padding:0.25rem 0.4rem; background:#fff; border-radius:4px"><code>{{date}}</code></div>
                <div style="padding:0.25rem 0.4rem; background:#fff; border-radius:4px"><code>{{email}}</code></div>
                <div style="padding:0.25rem 0.4rem; background:#fff; border-radius:4px"><code>{{org}}</code></div>
              </div>
            </div>

          </div>

          <!-- RIGHT: Live Canvas Preview -->
          <div>
            <div class="clay-card" style="padding: 1.25rem; text-align:center">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem">
                <h3 style="font-size: 1.05rem; font-weight: 800; margin:0">👁️ Live Interactive Canvas Preview</h3>
                <span class="badge badge-clay">Sample Student Data Rendered</span>
              </div>

              <!-- Canvas Container (900x636 fixed size ratio) -->
              <div style="overflow-x:auto; display:flex; justify-content:center; background:#cbd5e1; padding: 1.25rem; border-radius: var(--radius-md)">
                <div id="cert-canvas" style="width: 900px; height: 636px; position: relative; background:${template.backgroundColor || '#fffdf7'}; border:${template.borderWidth || 8}px ${template.borderStyle || 'double'} ${template.borderColor || '#c8a96e'}; box-shadow: 0 10px 30px rgba(0,0,0,0.2); text-align:left; user-select:none; overflow:hidden">
                  
                  <!-- Background Image -->
                  <img id="cert-canvas-bg" style="position:absolute; left:0; top:0; width:100%; height:100%; object-fit:cover; pointer-events:none; ${hasUpload ? '' : 'display:none'}">

                  <!-- Dynamic Text Elements Overlaid -->
                  ${template.elements.map(e => {
                    const isSel = e.id === selectedId;
                    let txt = e.content || '';
                    for (const [k, v] of Object.entries(sampleValues)) txt = txt.replaceAll(k, v);
                    return `
                      <div class="cert-el ${isSel ? 'selected' : ''}" data-elid="${e.id}"
                        style="position:absolute; left:${e.x}px; top:${e.y}px; font-size:${e.fontSize || 16}px; color:${e.color || '#333'}; font-family:${e.fontFamily || "'Playfair Display',serif"}; font-weight:${e.fontWeight || 'normal'}; text-align:${e.textAlign || 'center'}; ${e.width ? `width:${e.width}px;` : ''} white-space:pre-wrap; line-height:1.4; cursor:move; outline:${isSel ? '2px solid #0284c7' : '1px dashed transparent'}; padding:2px">
                        ${escapeHtml(txt)}
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
              <div style="font-size:0.78rem; color:var(--text-sub); margin-top:0.6rem">
                💡 Click any element on canvas to select it. Drag or use left panel X/Y to reposition.
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;

  // Set background image programmatically if available
  if (hasUpload) {
    const bgImg = document.getElementById('cert-canvas-bg');
    if (bgImg) bgImg.src = previewObjectUrl || template.backgroundImage;
  }

  bindEvents(app);
}

function bindEvents(app) {
  const dropZone = app.querySelector('#upload-drop-zone');
  const fileInput = app.querySelector('#cert-upload');

  dropZone?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) handleFile(file, app);
  });

  dropZone?.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--clay-primary)';
  });
  dropZone?.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file) handleFile(file, app);
  });

  app.querySelector('#btn-remove-upload')?.addEventListener('click', () => {
    template.backgroundImage = '';
    if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null; }
    showToast('Background image removed');
    renderPage(app);
  });

  // Element selection on canvas or list
  app.querySelectorAll('.cert-el, .layer-item').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      selectedId = el.dataset.elid;
      renderPage(app);
    });
  });

  // Canvas click to deselect
  app.querySelector('#cert-canvas')?.addEventListener('click', () => {
    selectedId = null;
    renderPage(app);
  });

  // Property inputs
  const sel = selectedId ? template.elements.find(e => e.id === selectedId) : null;
  if (sel) {
    app.querySelector('#prop-content')?.addEventListener('input', e => { sel.content = e.target.value; updateCanvasEl(sel); });
    app.querySelector('#prop-fs')?.addEventListener('input', e => { sel.fontSize = parseInt(e.target.value) || 16; updateCanvasEl(sel); });
    app.querySelector('#prop-color')?.addEventListener('input', e => { sel.color = e.target.value; updateCanvasEl(sel); });
    app.querySelector('#prop-font')?.addEventListener('change', e => { sel.fontFamily = e.target.value; updateCanvasEl(sel); });
    app.querySelector('#prop-align')?.addEventListener('change', e => { sel.textAlign = e.target.value; updateCanvasEl(sel); });
    app.querySelector('#prop-x')?.addEventListener('input', e => { sel.x = parseInt(e.target.value) || 0; updateCanvasEl(sel); });
    app.querySelector('#prop-y')?.addEventListener('input', e => { sel.y = parseInt(e.target.value) || 0; updateCanvasEl(sel); });
    app.querySelector('#prop-w')?.addEventListener('input', e => { sel.width = parseInt(e.target.value) || 800; updateCanvasEl(sel); });
  }

  // Delete element
  app.querySelectorAll('.del-el').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      template.elements = template.elements.filter(x => x.id !== btn.dataset.elid);
      if (selectedId === btn.dataset.elid) selectedId = null;
      renderPage(app);
    });
  });

  // Add new placeholder element
  const addBlockHandler = () => {
    const newEl = { id: generateId(), type: 'text', content: '{{name}}', x: 50, y: 250, fontSize: 32, color: '#0284c7', fontFamily: "'Great Vibes',cursive", fontWeight: '700', textAlign: 'center', width: 800 };
    template.elements.push(newEl);
    selectedId = newEl.id;
    renderPage(app);
  };
  app.querySelector('#btn-add-placeholder')?.addEventListener('click', addBlockHandler);
  app.querySelector('#btn-add-text')?.addEventListener('click', addBlockHandler);

  // Dragging elements on canvas
  let dragging = false, dragStart = { x: 0, y: 0 }, elStart = { x: 0, y: 0 };
  const selDom = selectedId ? app.querySelector(`.cert-el[data-elid="${selectedId}"]`) : null;
  if (selDom && sel) {
    selDom.addEventListener('mousedown', e => {
      e.stopPropagation();
      dragging = true;
      dragStart = { x: e.clientX, y: e.clientY };
      elStart = { x: sel.x, y: sel.y };
    });
    window.addEventListener('mousemove', e => {
      if (!dragging || !sel) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      sel.x = Math.max(0, Math.min(850, elStart.x + dx));
      sel.y = Math.max(0, Math.min(600, elStart.y + dy));
      updateCanvasEl(sel);
      const inputX = app.querySelector('#prop-x');
      const inputY = app.querySelector('#prop-y');
      if (inputX) inputX.value = sel.x;
      if (inputY) inputY.value = sel.y;
    });
    window.addEventListener('mouseup', () => { dragging = false; });
  }

  // Save
  app.querySelector('#btn-save')?.addEventListener('click', async () => {
    const name = app.querySelector('#tmpl-name')?.value?.trim();
    if (!name) { showToast('Please enter a template name', 'error'); return; }
    template.name = name;
    
    const btn = app.querySelector('#btn-save');
    btn.disabled = true;
    btn.textContent = '⏳ Saving...';
    
    try {
      await saveCertTemplate(template);
      showToast('Certificate template saved successfully! 🎓');
      window.location.hash = '#/admin';
    } catch (err) {
      console.error('Save error:', err);
      showToast('Failed to save template: ' + (err.message || 'Server error'), 'error');
      btn.disabled = false;
      btn.textContent = '💾 Save Template';
    }
  });
}

function updateCanvasEl(data) {
  const domEl = document.querySelector(`.cert-el[data-elid="${data.id}"]`);
  if (!domEl) return;
  domEl.style.left = data.x + 'px';
  domEl.style.top = data.y + 'px';
  domEl.style.fontSize = (data.fontSize || 16) + 'px';
  domEl.style.color = data.color || '#333';
  domEl.style.fontFamily = data.fontFamily || "'Playfair Display',serif";
  domEl.style.textAlign = data.textAlign || 'center';
  if (data.width) domEl.style.width = data.width + 'px';
}

function handleFile(file, app) {
  if (file.size > 10 * 1024 * 1024) { showToast('File too large (Max 10MB)', 'error'); return; }
  if (!file.type.startsWith('image/')) { showToast('Upload a valid PNG, JPG or WebP image', 'error'); return; }

  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = URL.createObjectURL(file);

  const reader = new FileReader();
  reader.onload = evt => {
    template.backgroundImage = evt.target.result;
    showToast('Background design uploaded! 📄');
    renderPage(app);
  };
  reader.readAsDataURL(file);
}
