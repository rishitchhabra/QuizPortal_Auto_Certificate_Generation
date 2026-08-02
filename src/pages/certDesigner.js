import { saveCertTemplate, getCertTemplate, deleteCertTemplate, generateId } from '../store.js';
import { renderNavbar, showToast, escapeHtml } from '../utils.js';
import { requireAdmin } from '../auth.js';

let template = null, selectedId = null;

export async function renderCertDesigner(app, params) {
  if (!requireAdmin()) return;

  const id = params[0];
  if (id && id !== 'new') {
    template = await getCertTemplate(id);
    if (!template) { window.location.hash = '#/admin'; return; }
  } else {
    template = defaultTemplate();
  }
  selectedId = null;
  renderDesigner(app);
}

function defaultTemplate() {
  return {
    id: generateId(),
    name: "Gyan Official Certificate Template",
    backgroundColor: '#fffdf7',
    borderColor: '#c8a96e',
    borderStyle: 'double',
    borderWidth: 8,
    backgroundImage: '', // Custom PDF / PNG background
    elements: [
      { id: generateId(), type: 'image', src: 'logo.png', x: 390, y: 35, width: 120, height: 100 },
      { id: generateId(), type: 'text', content: 'CERTIFICATE OF EXCELLENCE', x: 150, y: 145, fontSize: 32, color: '#c8a96e', fontFamily: "'Playfair Display',serif", fontWeight: '700', textAlign: 'center', width: 600 },
      { id: generateId(), type: 'text', content: 'PROUDLY PRESENTED TO', x: 250, y: 195, fontSize: 13, color: '#8a7a5a', fontFamily: "'Outfit',sans-serif", fontWeight: '600', textAlign: 'center', width: 400 },
      { id: generateId(), type: 'text', content: '{{name}}', x: 150, y: 230, fontSize: 38, color: '#0284c7', fontFamily: "'Great Vibes',cursive", fontWeight: '400', textAlign: 'center', width: 600 },
      { id: generateId(), type: 'text', content: '─────────────────────────', x: 200, y: 290, fontSize: 14, color: '#c8a96e', fontFamily: 'serif', fontWeight: 'normal', textAlign: 'center', width: 500 },
      { id: generateId(), type: 'text', content: 'for outstanding achievement in', x: 200, y: 325, fontSize: 14, color: '#666666', fontFamily: "'Outfit',sans-serif", fontWeight: '400', textAlign: 'center', width: 500 },
      { id: generateId(), type: 'text', content: '{{quiz_title}}', x: 150, y: 360, fontSize: 22, color: '#1e293b', fontFamily: "'Playfair Display',serif", fontWeight: '700', textAlign: 'center', width: 600 },
      { id: generateId(), type: 'text', content: 'Final Score: {{score}} / {{total}} ({{percent}})', x: 200, y: 415, fontSize: 15, color: '#555555', fontFamily: "'Outfit',sans-serif", fontWeight: '500', textAlign: 'center', width: 500 },
      { id: generateId(), type: 'text', content: 'Date: {{date}}', x: 100, y: 500, fontSize: 13, color: '#888888', fontFamily: "'Outfit',sans-serif", fontWeight: '400', textAlign: 'center', width: 250 },
      { id: generateId(), type: 'text', content: '________________________\nAuthorized Controller', x: 550, y: 485, fontSize: 13, color: '#888888', fontFamily: "'Outfit',sans-serif", fontWeight: '400', textAlign: 'center', width: 250 },
    ],
    createdAt: new Date().toISOString()
  };
}

function renderDesigner(app) {
  const sel = selectedId ? template.elements.find(e => e.id === selectedId) : null;

  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in" style="padding-top: 60px">
      
      <!-- Top Action Bar -->
      <div style="background: #ffffff; border-bottom: 1px solid rgba(160,195,230,0.3); padding: 0.85rem 1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap: 1rem; box-shadow: var(--clay-shadow-btn)">
        <div style="display:flex; align-items:center; gap: 1rem">
          <a href="#/admin" class="btn btn-ghost btn-sm">← Admin Portal</a>
          <input type="text" id="tmpl-name" value="${escapeHtml(template.name)}" class="form-input" placeholder="Template Name" style="font-weight:800; font-size:1.1rem; width: 320px">
        </div>
        
        <div style="display:flex; gap: 0.5rem">
          <button class="btn btn-secondary btn-sm" id="btn-add-text">+ Add Text Overlay</button>
          <button class="btn btn-secondary btn-sm" id="btn-add-img">+ Add Logo Image</button>
          <button class="btn btn-success btn-sm" id="btn-save">💾 Save Certificate Template</button>
        </div>
      </div>

      <div class="container" style="margin-top: 1.5rem; margin-bottom: 3rem">
        
        <div class="grid grid-2" style="grid-template-columns: 360px 1fr; gap: 1.5rem">
          
          <!-- LEFT SIDEBAR: PDF / Background Upload & Placeholders Guide -->
          <div style="display:flex; flex-direction:column; gap: 1.25rem">
            
            <!-- 1. Background Image / PDF Upload Card -->
            <div class="clay-card">
              <h3 style="font-size: 1.05rem; font-weight: 800; margin-bottom: 0.5rem">📄 Upload Background Design (Image / PDF)</h3>
              <p style="font-size: 0.8rem; color: var(--text-sub); margin-bottom: 1rem">
                Upload your custom certificate graphic (PDF, PNG, JPG). Text placeholders will overlay on top.
              </p>
              
              <div class="form-group">
                <input type="file" id="bg-upload-file" accept="image/*,application/pdf" class="form-input" style="font-size: 0.8rem">
              </div>

              ${template.backgroundImage ? `
                <div style="margin-top: 0.75rem; text-align: center">
                  <span class="badge badge-success" style="margin-bottom:0.5rem">Custom Background Uploaded</span>
                  <button class="btn btn-danger btn-sm" id="btn-remove-bg" style="width:100%">🗑️ Remove Custom Background</button>
                </div>
              ` : ''}
            </div>

            <!-- 2. Dynamic Placeholders Reference Guide -->
            <div class="clay-card" style="background: #f8fafc">
              <h3 style="font-size: 1rem; font-weight: 800; margin-bottom: 0.5rem; color: var(--clay-primary)">
                📌 Dynamic Text Placeholders
              </h3>
              <p style="font-size: 0.75rem; color: var(--text-sub); margin-bottom: 0.75rem">
                Use these tags inside any text block to dynamically insert student & quiz details:
              </p>
              
              <div style="display:flex; flex-direction:column; gap: 0.4rem; font-size: 0.8rem">
                <div style="display:flex; justify-content:space-between; padding: 0.35rem 0.6rem; background:#fff; border-radius:4px">
                  <code style="color:#0284c7; font-weight:800">{{name}}</code>
                  <span>Student Full Name</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding: 0.35rem 0.6rem; background:#fff; border-radius:4px">
                  <code style="color:#0284c7; font-weight:800">{{quiz_title}}</code>
                  <span>Quiz Title</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding: 0.35rem 0.6rem; background:#fff; border-radius:4px">
                  <code style="color:#0284c7; font-weight:800">{{score}}</code>
                  <span>Earned Points</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding: 0.35rem 0.6rem; background:#fff; border-radius:4px">
                  <code style="color:#0284c7; font-weight:800">{{total}}</code>
                  <span>Total Points</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding: 0.35rem 0.6rem; background:#fff; border-radius:4px">
                  <code style="color:#0284c7; font-weight:800">{{percent}}</code>
                  <span>Score Percentage %</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding: 0.35rem 0.6rem; background:#fff; border-radius:4px">
                  <code style="color:#0284c7; font-weight:800">{{date}}</code>
                  <span>Completion Date</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding: 0.35rem 0.6rem; background:#fff; border-radius:4px">
                  <code style="color:#0284c7; font-weight:800">{{email}}</code>
                  <span>Student Google Email</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding: 0.35rem 0.6rem; background:#fff; border-radius:4px">
                  <code style="color:#0284c7; font-weight:800">{{org}}</code>
                  <span>Class / School Name</span>
                </div>
              </div>
            </div>

            <!-- 3. Layer / Element Manager -->
            <div class="clay-card">
              <h3 style="font-size: 1rem; font-weight: 800; margin-bottom: 0.75rem">📝 Certificate Text Blocks</h3>
              <div style="display:flex; flex-direction:column; gap: 0.4rem; max-height: 280px; overflow-y:auto">
                ${template.elements.map((e, idx) => `
                  <div class="layer-item ${e.id === selectedId ? 'active' : ''}" data-elid="${e.id}" style="display:flex; justify-content:space-between; align-items:center; padding: 0.5rem 0.75rem; background: ${e.id === selectedId ? '#e0f2fe' : '#fff'}; border-radius:var(--radius-sm); cursor:pointer">
                    <span style="font-size:0.8rem; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width: 220px">
                      ${e.type === 'image' ? '📷 Logo Image' : escapeHtml(e.content)}
                    </span>
                    <button class="btn btn-danger btn-sm del-el" data-elid="${e.id}" style="padding: 0.15rem 0.4rem; font-size:0.7rem">✕</button>
                  </div>
                `).join('')}
              </div>
            </div>

          </div>

          <!-- RIGHT PANEL: Live Certificate Preview Canvas & Selected Properties -->
          <div style="display:flex; flex-direction:column; gap: 1.25rem">
            
            <!-- Live Preview Canvas -->
            <div class="clay-card" style="padding: 1.5rem; text-align: center">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem">
                <h3 style="font-size: 1.1rem; font-weight: 800">👁️ Live Certificate Preview</h3>
                <span class="badge badge-clay">Sample Participant Preview</span>
              </div>
              
              <div style="overflow-x:auto; display:flex; justify-content:center; background:#cbd5e1; padding: 1.5rem; border-radius: var(--radius-md)">
                <div id="cert-canvas" style="width: 800px; height: 565px; position: relative; background:${template.backgroundColor || '#fffdf7'}; border:${template.borderWidth || 8}px ${template.borderStyle || 'double'} ${template.borderColor || '#c8a96e'}; box-shadow: 0 10px 30px rgba(0,0,0,0.2); text-align:left">
                  ${template.backgroundImage ? `<img src="${template.backgroundImage}" style="position:absolute; left:0; top:0; width:100%; height:100%; object-fit:cover; pointer-events:none">` : ''}
                  
                  ${template.elements.map(e => {
                    const isSel = e.id === selectedId;
                    const previewPlaceholders = {
                      '{{name}}': 'Rishit Singh Chhabra',
                      '{{quiz_title}}': 'General Science Evaluation',
                      '{{score}}': '20',
                      '{{total}}': '20',
                      '{{percent}}': '100%',
                      '{{date}}': 'August 2, 2026',
                      '{{email}}': 'student@gyan.edu',
                      '{{org}}': 'Class 10-A'
                    };
                    if (e.type === 'image') {
                      return `
                        <div class="cert-el ${isSel ? 'selected' : ''}" data-elid="${e.id}"
                          style="left:${e.x}px; top:${e.y}px; width:${e.width || 100}px; height:${e.height || 100}px">
                          <img src="${e.src}" style="width:100%; height:100%; object-fit:contain; pointer-events:none">
                        </div>`;
                    }
                    let txt = e.content || '';
                    for (const [k, v] of Object.entries(previewPlaceholders)) txt = txt.replaceAll(k, v);
                    return `
                      <div class="cert-el ${isSel ? 'selected' : ''}" data-elid="${e.id}"
                        style="left:${e.x}px; top:${e.y}px; font-size:${e.fontSize || 16}px; color:${e.color || '#333'}; font-family:${e.fontFamily || "'Playfair Display',serif"}; font-weight:${e.fontWeight || 'normal'}; font-style:${e.fontStyle || 'normal'}; text-align:${e.textAlign || 'center'}; ${e.width ? `width:${e.width}px;` : ''} white-space:pre-wrap; line-height:1.4">
                        ${escapeHtml(txt)}
                      </div>`;
                  }).join('')}
                </div>
              </div>
            </div>

            <!-- Active Selected Element Property Controls -->
            ${sel ? `
              <div class="clay-card">
                <h3 style="font-size: 1.05rem; font-weight: 800; margin-bottom: 1rem; color: var(--clay-primary)">
                  ✏️ Edit Selected Overlay: "${sel.type === 'image' ? 'Logo Image' : escapeHtml(sel.content).substring(0, 25)}"
                </h3>
                
                ${sel.type !== 'image' ? `
                  <div class="form-group">
                    <label class="form-label">Text Content (Supports Placeholders)</label>
                    <input type="text" class="form-input" id="prop-content" value="${escapeHtml(sel.content)}">
                  </div>

                  <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem">
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">Font Family</label>
                      <select class="form-select" id="prop-font">
                        <option value="'Playfair Display',serif" ${sel.fontFamily?.includes('Playfair') ? 'selected' : ''}>Playfair Display (Serif)</option>
                        <option value="'Great Vibes',cursive" ${sel.fontFamily?.includes('Great') ? 'selected' : ''}>Great Vibes (Cursive)</option>
                        <option value="'Outfit',sans-serif" ${sel.fontFamily?.includes('Outfit') ? 'selected' : ''}>Outfit (Sans-Serif)</option>
                        <option value="'Inter',sans-serif" ${sel.fontFamily?.includes('Inter') ? 'selected' : ''}>Inter (Modern)</option>
                      </select>
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">Font Size (px)</label>
                      <input type="number" class="form-input" id="prop-fs" value="${sel.fontSize || 16}">
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">Text Color</label>
                      <input type="color" class="form-input" id="prop-color" value="${sel.color || '#333333'}" style="height:38px; padding:2px">
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">Alignment</label>
                      <select class="form-select" id="prop-align">
                        <option value="center" ${sel.textAlign === 'center' ? 'selected' : ''}>Center</option>
                        <option value="left" ${sel.textAlign === 'left' ? 'selected' : ''}>Left</option>
                        <option value="right" ${sel.textAlign === 'right' ? 'selected' : ''}>Right</option>
                      </select>
                    </div>
                  </div>
                ` : ''}

                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem">
                  <div class="form-group" style="margin-bottom:0">
                    <label class="form-label">X Position (px)</label>
                    <input type="number" class="form-input" id="prop-x" value="${sel.x}">
                  </div>
                  <div class="form-group" style="margin-bottom:0">
                    <label class="form-label">Y Position (px)</label>
                    <input type="number" class="form-input" id="prop-y" value="${sel.y}">
                  </div>
                  <div class="form-group" style="margin-bottom:0">
                    <label class="form-label">Width Box (px)</label>
                    <input type="number" class="form-input" id="prop-w" value="${sel.width || 500}">
                  </div>
                </div>
              </div>
            ` : ''}

          </div>

        </div>

      </div>
    </div>
  `;

  bindEvents(app);
}

function bindEvents(app) {
  // Background Upload
  app.querySelector('#bg-upload-file')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      template.backgroundImage = evt.target.result;
      showToast('Custom background template uploaded! 📄');
      renderDesigner(app);
    };
    reader.readAsDataURL(file);
  });

  app.querySelector('#btn-remove-bg')?.addEventListener('click', () => {
    template.backgroundImage = '';
    showToast('Custom background removed');
    renderDesigner(app);
  });

  // Layer click
  app.querySelectorAll('.layer-item, .cert-el').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      selectedId = el.dataset.elid;
      renderDesigner(app);
    });
  });

  // Delete layer
  app.querySelectorAll('.del-el').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      template.elements = template.elements.filter(x => x.id !== btn.dataset.elid);
      if (selectedId === btn.dataset.elid) selectedId = null;
      renderDesigner(app);
    });
  });

  // Property binds
  const sel = selectedId ? template.elements.find(e => e.id === selectedId) : null;
  if (sel) {
    app.querySelector('#prop-content')?.addEventListener('input', e => { sel.content = e.target.value; renderDesigner(app); });
    app.querySelector('#prop-font')?.addEventListener('change', e => { sel.fontFamily = e.target.value; renderDesigner(app); });
    app.querySelector('#prop-fs')?.addEventListener('input', e => { sel.fontSize = parseInt(e.target.value) || 16; renderDesigner(app); });
    app.querySelector('#prop-color')?.addEventListener('input', e => { sel.color = e.target.value; renderDesigner(app); });
    app.querySelector('#prop-align')?.addEventListener('change', e => { sel.textAlign = e.target.value; renderDesigner(app); });
    app.querySelector('#prop-x')?.addEventListener('input', e => { sel.x = parseInt(e.target.value) || 0; renderDesigner(app); });
    app.querySelector('#prop-y')?.addEventListener('input', e => { sel.y = parseInt(e.target.value) || 0; renderDesigner(app); });
    app.querySelector('#prop-w')?.addEventListener('input', e => { sel.width = parseInt(e.target.value) || 500; renderDesigner(app); });
  }

  // Add text block
  app.querySelector('#btn-add-text')?.addEventListener('click', () => {
    const newEl = { id: generateId(), type: 'text', content: '{{name}}', x: 200, y: 250, fontSize: 32, color: '#0284c7', fontFamily: "'Great Vibes',cursive", fontWeight: '700', textAlign: 'center', width: 500 };
    template.elements.push(newEl);
    selectedId = newEl.id;
    renderDesigner(app);
  });

  // Add logo image
  app.querySelector('#btn-add-img')?.addEventListener('click', () => {
    const newImg = { id: generateId(), type: 'image', src: 'logo.png', x: 350, y: 30, width: 100, height: 90 };
    template.elements.push(newImg);
    selectedId = newImg.id;
    renderDesigner(app);
  });

  // Save template
  app.querySelector('#btn-save')?.addEventListener('click', async () => {
    template.name = app.querySelector('#tmpl-name')?.value?.trim() || 'Untitled Certificate';
    await saveCertTemplate(template);
    showToast('Certificate template saved successfully! 🎨');
    window.location.hash = '#/admin';
  });
}
