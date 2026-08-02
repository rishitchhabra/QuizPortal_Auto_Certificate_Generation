import { saveCertTemplate, getCertTemplate, generateId, uploadPptxTemplate } from '../store.js';
import { renderNavbar, showToast, escapeHtml } from '../utils.js';
import { requireAdmin } from '../auth.js';

let template = null;
let selectedId = null;
let previewObjectUrl = null;
let activeTab = 'pptx'; // 'pptx' or 'image'

export async function renderCertDesigner(app, params) {
  if (!requireAdmin()) return;

  if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null; }

  const id = params[0];
  if (id && id !== 'new') {
    template = await getCertTemplate(id);
    if (!template) { window.location.hash = '#/admin'; return; }
    // Detect template type
    activeTab = template.type === 'pptx' ? 'pptx' : 'image';
  } else {
    template = {
      id: generateId(),
      name: '',
      type: 'pptx',
      backgroundImage: '',
      pptxFile: null, // frontend-only; holds the File object
      pptxFilename: '',
      elements: [],
      createdAt: new Date().toISOString()
    };
    activeTab = 'pptx';
  }
  selectedId = null;
  renderPage(app);
}

function renderPage(app) {
  if (!template.elements) template.elements = [];
  const sel = selectedId ? template.elements.find(e => e.id === selectedId) : null;
  const hasImageUpload = !!template.backgroundImage || !!previewObjectUrl;
  const hasPptx = !!template.pptxFile || !!template.pptxFilename;

  const sampleValues = {
    '{{name}}': 'Rishit Singh Chhabra',
    '{{quiz_title}}': 'General Science Evaluation',
    '{{score}}': '20', '{{total}}': '20', '{{percent}}': '100%',
    '{{date}}': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    '{{email}}': 'student@gyan.edu', '{{org}}': 'Class 10-A'
  };

  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container" style="max-width: 1200px; margin-top: 1.5rem; margin-bottom: 4rem">

        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; flex-wrap:wrap; gap: 1rem">
          <div>
            <a href="#/admin" class="btn btn-ghost btn-sm" style="margin-bottom: 0.4rem">← Back to Admin Portal</a>
            <h1 style="font-size: 1.6rem; font-weight: 900">🎓 Certificate Template</h1>
          </div>
        </div>

        <!-- Tab Selector -->
        <div style="display:flex; gap:0; margin-bottom: 1.5rem; background: var(--bg-input); border-radius: var(--radius-md); padding:4px; box-shadow: var(--clay-shadow-input); width: fit-content">
          <button class="tab-btn ${activeTab === 'pptx' ? 'active' : ''}" id="tab-pptx" style="padding: 0.6rem 1.5rem; border:none; border-radius: var(--radius-sm); cursor:pointer; font-weight:800; font-size:0.88rem; transition:all 0.2s; ${activeTab === 'pptx' ? 'background:var(--clay-primary); color:#fff; box-shadow: 0 2px 8px rgba(2,132,199,0.3)' : 'background:transparent; color:var(--text-sub)'}">
            📄 Upload PPTX (Recommended)
          </button>
          <button class="tab-btn ${activeTab === 'image' ? 'active' : ''}" id="tab-image" style="padding: 0.6rem 1.5rem; border:none; border-radius: var(--radius-sm); cursor:pointer; font-weight:800; font-size:0.88rem; transition:all 0.2s; ${activeTab === 'image' ? 'background:var(--clay-primary); color:#fff; box-shadow: 0 2px 8px rgba(2,132,199,0.3)' : 'background:transparent; color:var(--text-sub)'}">
            🖼️ Image + Text Overlay
          </button>
        </div>

        ${activeTab === 'pptx' ? renderPptxTab(hasPptx) : renderImageTab(sel, hasImageUpload, sampleValues)}

      </div>
    </div>
  `;

  // Set preview images programmatically
  if (activeTab === 'image' && hasImageUpload) {
    const bgImg = document.getElementById('cert-canvas-bg');
    if (bgImg) bgImg.src = previewObjectUrl || template.backgroundImage;
  }

  bindEvents(app);
}

function renderPptxTab(hasPptx) {
  return `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1.5rem">
      
      <!-- LEFT: Upload -->
      <div style="display:flex; flex-direction:column; gap: 1.25rem">
        
        <div class="clay-card">
          <h3 style="font-size: 1rem; font-weight: 800; margin-bottom: 0.75rem">📝 Template Name</h3>
          <input type="text" class="form-input" id="tmpl-name" value="${escapeHtml(template.name)}" placeholder="e.g. Science Quiz Achievement Certificate" style="font-weight: 700">
        </div>

        <div class="clay-card">
          <h3 style="font-size: 1.1rem; font-weight: 800; margin-bottom: 0.5rem">📄 Upload PowerPoint (.pptx) Certificate</h3>
          <p style="font-size: 0.82rem; color: var(--text-sub); margin-bottom: 1rem">
            Design your certificate in <strong>PowerPoint, Google Slides, or Canva</strong>. 
            Type placeholder tags like <code>{{name}}</code> in text boxes wherever you want dynamic student data. 
            Export as <strong>.pptx</strong> and upload here. <strong>No manual positioning required!</strong>
          </p>

          <div style="border: 2px dashed ${hasPptx ? 'var(--clay-success)' : 'rgba(160,195,230,0.5)'}; border-radius: var(--radius-md); padding: 2rem; text-align:center; background: ${hasPptx ? 'rgba(34,197,94,0.05)' : 'var(--bg-input)'}; cursor: pointer; transition: all 0.2s" id="pptx-drop-zone">
            ${hasPptx ? `
              <div style="font-size: 3rem; margin-bottom: 0.5rem">✅</div>
              <div style="font-weight: 800; color: var(--clay-success); font-size: 1.1rem; margin-bottom: 0.3rem">PPTX Template Uploaded!</div>
              <div style="font-size: 0.82rem; color: var(--text-sub)">
                ${template.pptxFile ? template.pptxFile.name : (template.pptxFilename || 'Saved on server')}
              </div>
              <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.4rem">Click to replace with a different file</div>
            ` : `
              <div style="font-size: 3.5rem; margin-bottom: 0.5rem">📤</div>
              <div style="font-weight: 800; font-size: 1.1rem; margin-bottom: 0.3rem">Click to Upload PPTX Certificate</div>
              <div style="font-size: 0.85rem; color: var(--text-sub)">or drag and drop your .pptx file here</div>
            `}
            <input type="file" id="pptx-upload" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" style="display:none">
          </div>

          ${hasPptx ? `
            <button class="btn btn-danger btn-sm" id="btn-remove-pptx" style="width: 100%; margin-top: 0.75rem">🗑️ Remove Uploaded PPTX</button>
          ` : ''}
        </div>

        <div style="text-align:center">
          <button class="btn btn-primary btn-lg" id="btn-save-pptx" ${!hasPptx ? 'disabled style="opacity:0.5"' : ''} style="width: 100%; font-size: 1rem; padding: 0.9rem">
            💾 Save PPTX Certificate Template
          </button>
        </div>
      </div>

      <!-- RIGHT: Placeholder Guide + How It Works -->
      <div style="display:flex; flex-direction:column; gap: 1.25rem">
        
        <div class="clay-card" style="background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border: 2px solid rgba(2,132,199,0.15)">
          <h3 style="font-size: 1.1rem; font-weight: 800; margin-bottom: 0.75rem; color: var(--clay-primary)">
            🪄 How PPTX Certificate Works
          </h3>
          <div style="font-size: 0.85rem; color: var(--text-main); line-height: 1.7">
            <div style="margin-bottom: 0.6rem"><strong>Step 1:</strong> Design your certificate in PowerPoint / Google Slides / Canva.</div>
            <div style="margin-bottom: 0.6rem"><strong>Step 2:</strong> Type placeholder tags (e.g. <code style="background:#fff;padding:2px 6px;border-radius:4px;color:#0284c7;font-weight:800">{{name}}</code>) directly in text boxes where you want dynamic data.</div>
            <div style="margin-bottom: 0.6rem"><strong>Step 3:</strong> Export as <strong>.pptx</strong> and upload here.</div>
            <div><strong>Step 4:</strong> That's it! When a student completes the quiz, the system replaces all tags with real values and generates the certificate automatically. 🎉</div>
          </div>
        </div>

        <div class="clay-card">
          <h3 style="font-size: 1.05rem; font-weight: 800; margin-bottom: 0.6rem; color: var(--clay-primary)">
            📌 Placeholder Tags — Type These in Your PPTX
          </h3>
          <p style="font-size: 0.78rem; color: var(--text-sub); margin-bottom: 0.6rem">
            Type these exact tags inside text boxes in your PowerPoint slide. They will be replaced automatically with real student data.
          </p>
          <div style="display:flex; flex-direction:column; gap: 0.4rem">
            ${[
              ['{{name}}', 'Student Full Name', '→ Rishit Singh Chhabra'],
              ['{{quiz_title}}', 'Quiz / Assessment Title', '→ Science Final Exam'],
              ['{{score}}', 'Earned Score Points', '→ 20'],
              ['{{total}}', 'Total Possible Points', '→ 20'],
              ['{{percent}}', 'Score Percentage', '→ 100%'],
              ['{{date}}', 'Certificate Date', '→ August 3, 2026'],
              ['{{email}}', 'Student Email', '→ student@gyan.edu'],
              ['{{org}}', 'Class / Institution', '→ Class 10-A'],
            ].map(([code, desc, example]) => `
              <div style="display:grid; grid-template-columns: 150px 1fr auto; align-items:center; padding: 0.5rem 0.75rem; background:#fff; border-radius:6px; gap: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05)">
                <code style="color:#0284c7; font-weight:800; font-size: 0.9rem; white-space:nowrap">${code}</code>
                <span style="font-size: 0.82rem; color: var(--text-sub)">${desc}</span>
                <span style="font-size: 0.78rem; color: var(--clay-success); font-weight: 600">${example}</span>
              </div>
            `).join('')}
          </div>

          <div style="margin-top: 1rem; padding: 0.75rem; background: #fff3cd; border-radius: var(--radius-sm); font-size: 0.82rem; color: #856404">
            <strong>⚠️ Important:</strong> Use double curly braces <code>{{name}}</code> in your PPTX. 
            Type the tag as <strong>one continuous text</strong> in a single text box (don't split across multiple text boxes).
          </div>
        </div>
      </div>

    </div>
  `;
}

function renderImageTab(sel, hasImageUpload, sampleValues) {
  return `
    <div style="display:grid; grid-template-columns: 360px 1fr; gap: 1.5rem">
      
      <!-- LEFT SIDEBAR -->
      <div style="display:flex; flex-direction:column; gap: 1.25rem">
        
        <div class="clay-card">
          <h3 style="font-size: 1rem; font-weight: 800; margin-bottom: 0.75rem">📝 Template Name</h3>
          <input type="text" class="form-input" id="tmpl-name" value="${escapeHtml(template.name)}" placeholder="e.g. Science Quiz Certificate" style="font-weight: 700">
        </div>

        <div class="clay-card">
          <h3 style="font-size: 1rem; font-weight: 800; margin-bottom: 0.5rem">📄 Upload Background Design</h3>
          <p style="font-size: 0.78rem; color: var(--text-sub); margin-bottom: 1rem">
            Upload background graphic (PNG, JPG, WebP). Dynamic text placeholders will overlay on top.
          </p>
          <div style="border: 2px dashed ${hasImageUpload ? 'var(--clay-success)' : 'rgba(160,195,230,0.5)'}; border-radius: var(--radius-md); padding: 1.25rem; text-align:center; background: ${hasImageUpload ? 'rgba(34,197,94,0.05)' : 'var(--bg-input)'}; cursor: pointer" id="upload-drop-zone">
            ${hasImageUpload ? `
              <div style="font-size: 2rem; margin-bottom: 0.2rem">✅</div>
              <div style="font-weight: 800; color: var(--clay-success); font-size:0.9rem">Background Uploaded</div>
              <div style="font-size: 0.75rem; color: var(--text-sub)">Click to replace</div>
            ` : `
              <div style="font-size: 2rem; margin-bottom: 0.2rem">📤</div>
              <div style="font-weight: 800; font-size:0.9rem">Upload Background</div>
              <div style="font-size: 0.75rem; color: var(--text-sub)">Click or drop image here</div>
            `}
            <input type="file" id="cert-upload" accept="image/png,image/jpeg,image/webp" style="display:none">
          </div>
          ${hasImageUpload ? `<button class="btn btn-danger btn-sm" id="btn-remove-upload" style="width:100%; margin-top:0.6rem; font-size:0.8rem">🗑️ Remove Background</button>` : ''}
        </div>

        ${sel ? `
          <div class="clay-card" style="border: 2px solid var(--clay-primary)">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem">
              <h3 style="font-size:0.95rem; font-weight:800; color:var(--clay-primary); margin:0">✏️ Edit Text Block</h3>
              <button class="btn btn-danger btn-sm del-el" data-elid="${sel.id}" style="padding:0.15rem 0.4rem; font-size:0.75rem">🗑️</button>
            </div>
            <div class="form-group" style="margin-bottom:0.6rem"><label class="form-label" style="font-size:0.78rem">Content</label><input type="text" class="form-input" id="prop-content" value="${escapeHtml(sel.content)}" style="font-size:0.85rem"></div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-bottom:0.6rem">
              <div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.78rem">Font Size</label><input type="number" class="form-input" id="prop-fs" value="${sel.fontSize || 16}" style="font-size:0.85rem"></div>
              <div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.78rem">Color</label><input type="color" class="form-input" id="prop-color" value="${sel.color || '#333333'}" style="height:35px; padding:2px"></div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-bottom:0.6rem">
              <div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.78rem">Font</label>
                <select class="form-select" id="prop-font" style="font-size:0.8rem">
                  <option value="'Playfair Display',serif" ${sel.fontFamily?.includes('Playfair') ? 'selected' : ''}>Playfair Display</option>
                  <option value="'Great Vibes',cursive" ${sel.fontFamily?.includes('Great') ? 'selected' : ''}>Great Vibes</option>
                  <option value="'Outfit',sans-serif" ${sel.fontFamily?.includes('Outfit') ? 'selected' : ''}>Outfit</option>
                  <option value="'Inter',sans-serif" ${sel.fontFamily?.includes('Inter') ? 'selected' : ''}>Inter</option>
                </select>
              </div>
              <div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.78rem">Align</label>
                <select class="form-select" id="prop-align" style="font-size:0.8rem">
                  <option value="center" ${sel.textAlign === 'center' ? 'selected' : ''}>Center</option>
                  <option value="left" ${sel.textAlign === 'left' ? 'selected' : ''}>Left</option>
                  <option value="right" ${sel.textAlign === 'right' ? 'selected' : ''}>Right</option>
                </select>
              </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.5rem">
              <div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.75rem">X</label><input type="number" class="form-input" id="prop-x" value="${sel.x}" style="font-size:0.8rem"></div>
              <div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.75rem">Y</label><input type="number" class="form-input" id="prop-y" value="${sel.y}" style="font-size:0.8rem"></div>
              <div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.75rem">Width</label><input type="number" class="form-input" id="prop-w" value="${sel.width || 800}" style="font-size:0.8rem"></div>
            </div>
          </div>
        ` : `
          <div class="clay-card" style="background:#f8fafc; text-align:center; padding:1rem"><div style="font-size:0.85rem; color:var(--text-sub)">Click any text on canvas to edit it.</div></div>
        `}

        <div class="clay-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem">
            <h3 style="font-size:0.95rem; font-weight:800">📝 Text Blocks</h3>
            <button class="btn btn-secondary btn-sm" id="btn-add-text" style="font-size:0.75rem; padding:0.2rem 0.5rem">+ Add</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.4rem; max-height:180px; overflow-y:auto">
            ${template.elements.map(e => `
              <div class="layer-item" data-elid="${e.id}" style="display:flex; justify-content:space-between; align-items:center; padding:0.35rem 0.5rem; background:${e.id === selectedId ? '#e0f2fe' : '#fff'}; border-radius:var(--radius-sm); cursor:pointer; font-size:0.8rem">
                <span style="font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:220px">${escapeHtml(e.content)}</span>
                <span style="font-size:0.7rem; color:var(--text-sub)">(${e.x},${e.y})</span>
              </div>
            `).join('')}
          </div>
        </div>

        <button class="btn btn-primary" id="btn-save" style="width:100%">💾 Save Image Template</button>
      </div>

      <!-- RIGHT: Canvas -->
      <div>
        <div class="clay-card" style="padding:1.25rem; text-align:center">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem">
            <h3 style="font-size:1.05rem; font-weight:800; margin:0">👁️ Live Canvas Preview</h3>
            <button class="btn btn-secondary btn-sm" id="btn-add-placeholder" style="font-size:0.8rem">+ Add Text Block</button>
          </div>
          <div style="overflow-x:auto; display:flex; justify-content:center; background:#cbd5e1; padding:1.25rem; border-radius:var(--radius-md)">
            <div id="cert-canvas" style="width:900px; height:636px; position:relative; background:${template.backgroundColor || '#fffdf7'}; border:${template.borderWidth || 8}px ${template.borderStyle || 'double'} ${template.borderColor || '#c8a96e'}; box-shadow:0 10px 30px rgba(0,0,0,0.2); text-align:left; user-select:none; overflow:hidden">
              <img id="cert-canvas-bg" style="position:absolute; left:0; top:0; width:100%; height:100%; object-fit:cover; pointer-events:none; ${hasImageUpload ? '' : 'display:none'}">
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
        </div>
      </div>

    </div>
  `;
}

function bindEvents(app) {
  // Tab switching
  app.querySelector('#tab-pptx')?.addEventListener('click', () => { activeTab = 'pptx'; template.type = 'pptx'; renderPage(app); });
  app.querySelector('#tab-image')?.addEventListener('click', () => {
    activeTab = 'image';
    template.type = 'image';
    // Initialize default elements if empty and switching to image mode for first time
    if (!template.elements || template.elements.length === 0) {
      template.elements = [
        { id: generateId(), type: 'text', content: '{{quiz_title}}', x: 50, y: 165, fontSize: 24, color: '#1e293b', fontFamily: "'Playfair Display',serif", fontWeight: '700', textAlign: 'center', width: 800 },
        { id: generateId(), type: 'text', content: '{{name}}', x: 50, y: 255, fontSize: 36, color: '#d97706', fontFamily: "'Great Vibes',cursive", fontWeight: '700', textAlign: 'center', width: 800 },
        { id: generateId(), type: 'text', content: 'Score: {{score}}/{{total}} ({{percent}})', x: 50, y: 330, fontSize: 14, color: '#475569', fontFamily: "'Outfit',sans-serif", fontWeight: '400', textAlign: 'center', width: 800 },
        { id: generateId(), type: 'text', content: 'Date: {{date}}', x: 100, y: 460, fontSize: 13, color: '#64748b', fontFamily: "'Outfit',sans-serif", fontWeight: '500', textAlign: 'center', width: 250 },
      ];
    }
    renderPage(app);
  });

  if (activeTab === 'pptx') {
    bindPptxEvents(app);
  } else {
    bindImageEvents(app);
  }
}

function bindPptxEvents(app) {
  const dropZone = app.querySelector('#pptx-drop-zone');
  const fileInput = app.querySelector('#pptx-upload');

  dropZone?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) handlePptxFile(file, app);
  });
  dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--clay-primary)'; });
  dropZone?.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; });
  dropZone?.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.style.borderColor = '';
    const file = e.dataTransfer?.files[0];
    if (file) handlePptxFile(file, app);
  });

  app.querySelector('#btn-remove-pptx')?.addEventListener('click', () => {
    template.pptxFile = null;
    template.pptxFilename = '';
    showToast('PPTX file removed');
    renderPage(app);
  });

  app.querySelector('#btn-save-pptx')?.addEventListener('click', async () => {
    const name = app.querySelector('#tmpl-name')?.value?.trim();
    if (!name) { showToast('Please enter a template name', 'error'); return; }
    if (!template.pptxFile && !template.pptxFilename) { showToast('Please upload a PPTX file first', 'error'); return; }

    const btn = app.querySelector('#btn-save-pptx');
    btn.disabled = true;
    btn.textContent = '⏳ Uploading & Saving...';

    try {
      if (template.pptxFile) {
        // New upload
        await uploadPptxTemplate(template.pptxFile, name, template.id);
      } else {
        // Just update name
        template.name = name;
        await saveCertTemplate(template);
      }
      showToast('PPTX Certificate template saved! 🎓');
      window.location.hash = '#/admin';
    } catch (err) {
      console.error('Save error:', err);
      showToast('Failed to save: ' + (err.message || 'Server error'), 'error');
      btn.disabled = false;
      btn.textContent = '💾 Save PPTX Certificate Template';
    }
  });
}

function bindImageEvents(app) {
  const dropZone = app.querySelector('#upload-drop-zone');
  const fileInput = app.querySelector('#cert-upload');

  dropZone?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', e => { const file = e.target.files[0]; if (file) handleImageFile(file, app); });
  dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--clay-primary)'; });
  dropZone?.addEventListener('drop', e => { e.preventDefault(); const file = e.dataTransfer?.files[0]; if (file) handleImageFile(file, app); });

  app.querySelector('#btn-remove-upload')?.addEventListener('click', () => {
    template.backgroundImage = '';
    if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null; }
    showToast('Background image removed');
    renderPage(app);
  });

  // Element selection
  app.querySelectorAll('.cert-el, .layer-item').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); selectedId = el.dataset.elid; renderPage(app); });
  });
  app.querySelector('#cert-canvas')?.addEventListener('click', () => { selectedId = null; renderPage(app); });

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

    // Drag
    const selDom = app.querySelector(`.cert-el[data-elid="${selectedId}"]`);
    if (selDom) {
      let dragging = false, dragStart = { x: 0, y: 0 }, elStart = { x: 0, y: 0 };
      selDom.addEventListener('mousedown', e => { e.stopPropagation(); dragging = true; dragStart = { x: e.clientX, y: e.clientY }; elStart = { x: sel.x, y: sel.y }; });
      window.addEventListener('mousemove', e => {
        if (!dragging) return;
        sel.x = Math.max(0, Math.min(850, elStart.x + e.clientX - dragStart.x));
        sel.y = Math.max(0, Math.min(600, elStart.y + e.clientY - dragStart.y));
        updateCanvasEl(sel);
        const ix = app.querySelector('#prop-x'); const iy = app.querySelector('#prop-y');
        if (ix) ix.value = sel.x; if (iy) iy.value = sel.y;
      });
      window.addEventListener('mouseup', () => { dragging = false; });
    }
  }

  // Delete element
  app.querySelectorAll('.del-el').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); template.elements = template.elements.filter(x => x.id !== btn.dataset.elid); if (selectedId === btn.dataset.elid) selectedId = null; renderPage(app); });
  });

  // Add text block
  const addHandler = () => {
    const newEl = { id: generateId(), type: 'text', content: '{{name}}', x: 50, y: 250, fontSize: 32, color: '#0284c7', fontFamily: "'Great Vibes',cursive", fontWeight: '700', textAlign: 'center', width: 800 };
    template.elements.push(newEl);
    selectedId = newEl.id;
    renderPage(app);
  };
  app.querySelector('#btn-add-placeholder')?.addEventListener('click', addHandler);
  app.querySelector('#btn-add-text')?.addEventListener('click', addHandler);

  // Save image template
  app.querySelector('#btn-save')?.addEventListener('click', async () => {
    const name = app.querySelector('#tmpl-name')?.value?.trim();
    if (!name) { showToast('Please enter a template name', 'error'); return; }
    template.name = name;
    template.type = 'image';
    const btn = app.querySelector('#btn-save');
    btn.disabled = true; btn.textContent = '⏳ Saving...';
    try {
      await saveCertTemplate(template);
      showToast('Certificate template saved! 🎓');
      window.location.hash = '#/admin';
    } catch (err) {
      console.error(err);
      showToast('Save failed: ' + (err.message || 'Error'), 'error');
      btn.disabled = false; btn.textContent = '💾 Save Image Template';
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

function handlePptxFile(file, app) {
  if (file.size > 20 * 1024 * 1024) { showToast('File too large (Max 20MB)', 'error'); return; }
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'pptx') { showToast('Please upload a .pptx file', 'error'); return; }
  template.pptxFile = file;
  showToast('PPTX file selected! 📄');
  renderPage(app);
}

function handleImageFile(file, app) {
  if (file.size > 10 * 1024 * 1024) { showToast('File too large (Max 10MB)', 'error'); return; }
  if (!file.type.startsWith('image/')) { showToast('Upload a valid image file', 'error'); return; }
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = URL.createObjectURL(file);
  const reader = new FileReader();
  reader.onload = evt => { template.backgroundImage = evt.target.result; showToast('Background uploaded! 📄'); renderPage(app); };
  reader.readAsDataURL(file);
}
