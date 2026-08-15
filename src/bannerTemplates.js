// Preset Banner Templates for Quizzes (SVG Data URLs)

function createSvgDataUrl(svgString) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
}

export const BANNER_TEMPLATES = [
  {
    id: 'template-indigo',
    name: 'Modern Gradient',
    category: 'General',
    color: '#4f46e5',
    url: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
        <defs>
          <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#4f46e5"/>
            <stop offset="50%" stop-color="#7c3aed"/>
            <stop offset="100%" stop-color="#2563eb"/>
          </linearGradient>
          <linearGradient id="g2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="630" fill="url(#g1)"/>
        <circle cx="1100" cy="80" r="320" fill="url(#g2)"/>
        <circle cx="100" cy="550" r="280" fill="url(#g2)"/>
        <path d="M-100,200 Q300,-100 700,300 T1300,100" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="6"/>
        <path d="M-100,400 Q400,100 800,500 T1300,300" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4"/>
        <g transform="translate(100, 220)">
          <rect width="90" height="90" rx="22" fill="rgba(255,255,255,0.2)"/>
          <path d="M30 45 L42 57 L62 33" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </g>
        <text x="220" y="275" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="52" fill="#ffffff">GYAN PORTAL ASSESSMENT</text>
        <text x="220" y="325" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="500" font-size="28" fill="rgba(255,255,255,0.85)">Test your knowledge · Certified Online Quiz</text>
      </svg>
    `)
  },
  {
    id: 'template-science',
    name: 'Science & Innovation',
    category: 'Science',
    color: '#0d9488',
    url: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
        <defs>
          <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f766e"/>
            <stop offset="50%" stop-color="#0d9488"/>
            <stop offset="100%" stop-color="#0284c7"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="630" fill="url(#g1)"/>
        <!-- Atom Orbit -->
        <g transform="translate(950, 315)" stroke="rgba(255,255,255,0.25)" fill="none" stroke-width="4">
          <ellipse rx="220" ry="80" transform="rotate(0)"/>
          <ellipse rx="220" ry="80" transform="rotate(60)"/>
          <ellipse rx="220" ry="80" transform="rotate(120)"/>
          <circle cx="0" cy="0" r="28" fill="#ffffff"/>
        </g>
        <g transform="translate(100, 220)">
          <rect width="90" height="90" rx="22" fill="rgba(255,255,255,0.2)"/>
          <path d="M45 25 L45 50 L30 70 L60 70 L45 50 Z" stroke="#ffffff" stroke-width="5" fill="none" stroke-linejoin="round"/>
        </g>
        <text x="220" y="275" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="52" fill="#ffffff">SCIENCE &amp; RESEARCH ASSESSMENT</text>
        <text x="220" y="325" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="500" font-size="28" fill="rgba(255,255,255,0.85)">Explore, Experiment &amp; Excel</text>
      </svg>
    `)
  },
  {
    id: 'template-math',
    name: 'Mathematics & Analytics',
    category: 'Mathematics',
    color: '#d97706',
    url: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
        <defs>
          <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#b45309"/>
            <stop offset="50%" stop-color="#d97706"/>
            <stop offset="100%" stop-color="#ca8a04"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="630" fill="url(#g1)"/>
        <!-- Math background grid -->
        <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
        </pattern>
        <rect width="1200" height="630" fill="url(#grid)"/>
        <text x="900" y="200" font-size="120" fill="rgba(255,255,255,0.15)" font-family="serif" font-weight="bold">∑ π √</text>
        <text x="820" y="450" font-size="140" fill="rgba(255,255,255,0.15)" font-family="serif" font-weight="bold">f(x) = ∫</text>
        <g transform="translate(100, 220)">
          <rect width="90" height="90" rx="22" fill="rgba(255,255,255,0.2)"/>
          <text x="27" y="62" font-size="48" font-family="sans-serif" font-weight="bold" fill="#ffffff">π</text>
        </g>
        <text x="220" y="275" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="52" fill="#ffffff">MATHEMATICS &amp; LOGIC QUIZ</text>
        <text x="220" y="325" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="500" font-size="28" fill="rgba(255,255,255,0.85)">Problem Solving &amp; Quantitative Skill Test</text>
      </svg>
    `)
  },
  {
    id: 'template-tech',
    name: 'Computer Science & AI',
    category: 'Technology',
    color: '#0284c7',
    url: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
        <defs>
          <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0369a1"/>
            <stop offset="50%" stop-color="#0284c7"/>
            <stop offset="100%" stop-color="#4f46e5"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="630" fill="url(#g1)"/>
        <!-- Code Symbols -->
        <text x="850" y="250" font-size="100" fill="rgba(255,255,255,0.12)" font-family="monospace" font-weight="bold">&lt;/&gt;</text>
        <text x="750" y="480" font-size="120" fill="rgba(255,255,255,0.12)" font-family="monospace" font-weight="bold">{ code }</text>
        <g transform="translate(100, 220)">
          <rect width="90" height="90" rx="22" fill="rgba(255,255,255,0.2)"/>
          <path d="M30 45 L42 33 L30 21 M60 45 L48 33 L60 21" stroke="#ffffff" stroke-width="6" stroke-linecap="round" fill="none"/>
        </g>
        <text x="220" y="275" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="52" fill="#ffffff">COMPUTER SCIENCE &amp; TECH</text>
        <text x="220" y="325" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="500" font-size="28" fill="rgba(255,255,255,0.85)">Coding, Algorithms &amp; Tech Challenge</text>
      </svg>
    `)
  },
  {
    id: 'template-cert',
    name: 'Excellence & Certification',
    category: 'Certification',
    color: '#854d0e',
    url: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
        <defs>
          <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#713f12"/>
            <stop offset="50%" stop-color="#a16207"/>
            <stop offset="100%" stop-color="#eab308"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="630" fill="url(#g1)"/>
        <g transform="translate(920, 200)" fill="rgba(255,255,255,0.15)">
          <path d="M100 0 L130 70 L200 80 L150 130 L160 200 L100 165 L40 200 L50 130 L0 80 L70 70 Z"/>
        </g>
        <g transform="translate(100, 220)">
          <rect width="90" height="90" rx="22" fill="rgba(255,255,255,0.2)"/>
          <path d="M45 20 L55 35 L75 38 L60 52 L64 72 L45 62 L26 72 L30 52 L15 38 L35 35 Z" fill="#ffffff"/>
        </g>
        <text x="220" y="275" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="52" fill="#ffffff">CERTIFICATION EXAMINATION</text>
        <text x="220" y="325" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="500" font-size="28" fill="rgba(255,255,255,0.85)">Earn Your Official Verified Certificate</text>
      </svg>
    `)
  },
  {
    id: 'template-dark',
    name: 'Cosmic Dark Luxury',
    category: 'Modern',
    color: '#0f172a',
    url: createSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
        <defs>
          <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#020617"/>
            <stop offset="50%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#1e1b4b"/>
          </linearGradient>
          <radialGradient id="r1" cx="80%" cy="20%" r="60%">
            <stop offset="0%" stop-color="#6366f1" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="1200" height="630" fill="url(#g1)"/>
        <rect width="1200" height="630" fill="url(#r1)"/>
        <g transform="translate(100, 220)">
          <rect width="90" height="90" rx="22" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
          <circle cx="45" cy="45" r="22" fill="none" stroke="#6366f1" stroke-width="6"/>
          <path d="M45 28 L45 45 L58 45" stroke="#ffffff" stroke-width="5" stroke-linecap="round" fill="none"/>
        </g>
        <text x="220" y="275" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="52" fill="#ffffff">ONLINE ASSESSMENT</text>
        <text x="220" y="325" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="500" font-size="28" fill="#94a3b8">Gyan International School · Smart Testing Portal</text>
      </svg>
    `)
  }
];
