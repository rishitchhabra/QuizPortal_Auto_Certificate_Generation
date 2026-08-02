import { saveCertTemplate, getCertTemplate, generateId } from '../store.js';
import { renderNavbar, showToast, escapeHtml } from '../utils.js';
import { requireAdmin } from '../auth.js';

let template = null;
// Store the raw object URL for preview (doesn't go into template literal)
let previewObjectUrl = null;

export async function renderCertDesigner(app, params) {
  if (!requireAdmin()) return;

  // Cleanup old object URL
  if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null; }

  const id = params[0];
  if (id && id !== 'new') {
    template = await getCertTemplate(id);
    if (!template) { window.location.hash = '#/admin'; return; }
  } else {
    template = {
      id: generateId(),
      name: '',
      backgroundImage: '',
      elements: [],
      createdAt: new Date().toISOString()
    };
  }
  renderPage(app);
}

function renderPage(app) {
  const hasUpload = !!template.backgroundImage || !!previewObjectUrl;

  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container" style="max-width: 980px; margin-top: 2rem; margin-bottom: 4rem">

        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; flex-wrap:wrap; gap: 1rem">
          <div>
            <a href="#/admin" class="btn btn-ghost btn-sm" style="margin-bottom: 0.4rem">← Back to Admin Portal</a>
            <h1 style="font-size: 1.6rem; font-weight: 900">🎓 Upload Certificate Template</h1>
            <p style="color: var(--text-sub); font-size: 0.85rem; margin-top: 0.2rem">
              Upload a pre-designed certificate image (PNG, JPG). The system will display this image as the certificate.
            </p>
          </div>
          <button class="btn btn-primary" id="btn-save" ${!hasUpload ? 'disabled style="opacity:0.5"' : ''}>💾 Save Certificate Template</button>
        </div>

        <div style="display:grid; grid-template-columns: 380px 1fr; gap: 1.5rem">
          
          <!-- LEFT: Upload + Placeholders -->
          <div style="display:flex; flex-direction:column; gap: 1.25rem">
            
            <!-- Template Name -->
            <div class="clay-card">
              <h3 style="font-size: 1rem; font-weight: 800; margin-bottom: 0.75rem">📝 Template Name</h3>
              <input type="text" class="form-input" id="tmpl-name" value="${escapeHtml(template.name)}" placeholder="e.g. Science Quiz Achievement Certificate" style="font-weight: 700">
            </div>

            <!-- Upload Area -->
            <div class="clay-card">
              <h3 style="font-size: 1rem; font-weight: 800; margin-bottom: 0.5rem">📄 Upload Certificate Design</h3>
              <p style="font-size: 0.78rem; color: var(--text-sub); margin-bottom: 1rem">
                Upload your custom-designed certificate image. Accepted formats: <strong>PNG, JPG, JPEG, WebP</strong>.
                Design it externally (Canva, Photoshop, etc.) and export as image.
              </p>

              <div style="border: 2px dashed ${hasUpload ? 'var(--clay-success)' : 'rgba(160,195,230,0.5)'}; border-radius: var(--radius-md); padding: 1.5rem; text-align:center; background: ${hasUpload ? 'rgba(34,197,94,0.05)' : 'var(--bg-input)'}; cursor: pointer; transition: all 0.2s" id="upload-drop-zone">
                ${hasUpload ? `
                  <div style="font-size: 2.5rem; margin-bottom: 0.4rem">✅</div>
                  <div style="font-weight: 800; color: var(--clay-success); margin-bottom: 0.4rem">Certificate Design Uploaded!</div>
                  <div style="font-size: 0.8rem; color: var(--text-sub)">Click to replace with a different file</div>
                ` : `
                  <div style="font-size: 2.5rem; margin-bottom: 0.4rem">📤</div>
                  <div style="font-weight: 800; margin-bottom: 0.4rem">Click to Upload Certificate</div>
                  <div style="font-size: 0.8rem; color: var(--text-sub)">or drag and drop your file here</div>
                `}
                <input type="file" id="cert-upload" accept="image/png,image/jpeg,image/webp,image/jpg" style="display:none">
              </div>

              ${hasUpload ? `
                <button class="btn btn-danger btn-sm" id="btn-remove-upload" style="width: 100%; margin-top: 0.75rem">🗑️ Remove Uploaded Certificate</button>
              ` : ''}
            </div>

            <!-- Placeholders Reference -->
            <div class="clay-card" style="background: linear-gradient(135deg, #f0f9ff, #f8fafc)">
              <h3 style="font-size: 1rem; font-weight: 800; margin-bottom: 0.5rem; color: var(--clay-primary)">
                📌 Dynamic Placeholders Reference
              </h3>
              <p style="font-size: 0.75rem; color: var(--text-sub); margin-bottom: 0.75rem">
                Use these placeholder tags <strong>inside your certificate design</strong> (in Canva, Photoshop, etc.).
                The system will automatically replace them with real student data when generating certificates.
              </p>

              <div style="display:flex; flex-direction:column; gap: 0.35rem; font-size: 0.82rem">
                ${[
                  ['{{name}}', 'Student Full Name (from Name field)'],
                  ['{{quiz_title}}', 'Quiz / Assessment Title'],
                  ['{{score}}', 'Earned Score Points'],
                  ['{{total}}', 'Total Possible Points'],
                  ['{{percent}}', 'Score Percentage (e.g. 85%)'],
                  ['{{date}}', 'Completion Date (August 2, 2026)'],
                  ['{{email}}', 'Student Email Address'],
                  ['{{org}}', 'School / Institution Name'],
                ].map(([code, desc]) => `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding: 0.4rem 0.6rem; background:#fff; border-radius:4px; gap: 0.5rem">
                    <code style="color:#0284c7; font-weight:800; font-size: 0.85rem; white-space:nowrap">${code}</code>
                    <span style="text-align:right; font-size: 0.78rem; color: var(--text-sub)">${desc}</span>
                  </div>
                `).join('')}
              </div>

              <div style="margin-top: 1rem; padding: 0.75rem; background: #fff3cd; border-radius: var(--radius-sm); font-size: 0.78rem; color: #856404">
                <strong>💡 Tip:</strong> Design your certificate in Canva or any design tool. Export as PNG/JPG and upload here.
              </div>
            </div>
          </div>

          <!-- RIGHT: Preview -->
          <div>
            <div class="clay-card" style="padding: 1.5rem">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem">
                <h3 style="font-size: 1.1rem; font-weight: 800">👁️ Certificate Preview</h3>
                <span class="badge badge-clay">Template Preview</span>
              </div>

              ${hasUpload ? `
                <div style="background: #e2e8f0; border-radius: var(--radius-md); padding: 1rem; text-align:center">
                  <img id="cert-preview-img" style="max-width: 100%; max-height: 600px; border-radius: var(--radius-sm); box-shadow: 0 8px 25px rgba(0,0,0,0.15)" alt="Certificate Preview">
                </div>
              ` : `
                <div style="background: #f1f5f9; border-radius: var(--radius-md); padding: 4rem 2rem; text-align:center; border: 2px dashed rgba(160,195,230,0.4)">
                  <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.4">🎨</div>
                  <h3 style="color: var(--text-sub); font-weight: 700; margin-bottom: 0.5rem">No Certificate Uploaded Yet</h3>
                  <p style="color: var(--text-muted); font-size: 0.85rem">Upload a certificate design on the left to see a preview here.</p>
                </div>
              `}
            </div>
          </div>

        </div>
      </div>
    </div>
  `;

  // Set preview image src PROGRAMMATICALLY (not in innerHTML) to avoid base64 breaking the DOM
  if (hasUpload) {
    const previewImg = document.getElementById('cert-preview-img');
    if (previewImg) {
      // Prefer the lightweight objectURL for preview; fallback to stored base64
      previewImg.src = previewObjectUrl || template.backgroundImage;
    }
  }

  bindEvents(app);
}

function bindEvents(app) {
  const dropZone = app.querySelector('#upload-drop-zone');
  const fileInput = app.querySelector('#cert-upload');

  // Click to upload
  dropZone?.addEventListener('click', () => fileInput?.click());

  // File selected
  fileInput?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    handleFile(file, app);
  });

  // Drag and drop
  dropZone?.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--clay-primary)';
    dropZone.style.background = 'rgba(2,132,199,0.05)';
  });
  dropZone?.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '';
    dropZone.style.background = '';
  });
  dropZone?.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.style.borderColor = '';
    dropZone.style.background = '';
    const file = e.dataTransfer?.files[0];
    if (file) handleFile(file, app);
  });

  // Remove upload
  app.querySelector('#btn-remove-upload')?.addEventListener('click', () => {
    template.backgroundImage = '';
    template.elements = [];
    if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null; }
    showToast('Certificate design removed');
    renderPage(app);
  });

  // Save
  app.querySelector('#btn-save')?.addEventListener('click', async () => {
    const name = app.querySelector('#tmpl-name')?.value?.trim();
    if (!name) { showToast('Please enter a template name', 'error'); return; }
    if (!template.backgroundImage) { showToast('Please upload a certificate design first', 'error'); return; }
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
      btn.textContent = '💾 Save Certificate Template';
    }
  });
}

function handleFile(file, app) {
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    showToast('File too large. Max 10MB allowed.', 'error');
    return;
  }

  // Validate it's actually an image
  if (!file.type.startsWith('image/')) {
    showToast('Please upload an image file (PNG, JPG, WebP)', 'error');
    return;
  }

  // Create an object URL for fast, lightweight preview
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = URL.createObjectURL(file);

  // Also read as base64 data URL for saving to server
  const reader = new FileReader();
  reader.onload = evt => {
    template.backgroundImage = evt.target.result;
    showToast('Certificate design uploaded! 📄');
    renderPage(app);
  };
  reader.onerror = () => {
    showToast('Failed to read file', 'error');
  };
  reader.readAsDataURL(file);
}
