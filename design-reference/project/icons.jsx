// ============================================================
// DUNE — Logo mark (key-D) + icon set
// ============================================================

// The signature "key" mark: a 4-point sparkle, a D-shaped bow, a shaft with teeth.
function KeyMark({ size = 40, color = "var(--sand)" }) {
  // viewBox 0 0 200 70
  return (
    <svg width={size * (200 / 70)} height={size} viewBox="0 0 200 70" fill="none"
         style={{ display: "block", overflow: "visible" }} aria-hidden="true">
      <g stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* 4-point star / sparkle */}
        <path d="M22 35 L34 31 L38 35 L34 39 Z M22 35 L10 31 L6 35 L10 39 Z M22 35 L18 23 L22 19 L26 23 Z M22 35 L18 47 L22 51 L26 47 Z" fill={color} stroke="none" />
        {/* connector */}
        <line x1="40" y1="35" x2="58" y2="35" />
        {/* D bow */}
        <path d="M70 12 L70 58" />
        <path d="M70 12 C 104 12, 122 24, 122 35 C 122 46, 104 58, 70 58" />
        {/* shaft */}
        <line x1="122" y1="35" x2="188" y2="35" />
        {/* teeth */}
        <path d="M150 35 L150 48" />
        <path d="M168 35 L168 50" />
      </g>
    </svg>
  );
}

// Full lockup: mark + DUNE wordmark + tagline. variant: "light" (on dark) | "dark" (on light)
function Logo({ variant = "light", showMark = true, size = "md", onClick }) {
  const color = variant === "light" ? "var(--paper)" : "var(--wine)";
  const sub = variant === "light" ? "rgba(246,246,246,0.55)" : "var(--sand-deep)";
  const markColor = "var(--sand)";
  const wm = { sm: 19, md: 24, lg: 30 }[size] || 24;
  const mk = { sm: 22, md: 27, lg: 34 }[size] || 27;
  return (
    <div onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, cursor: onClick ? "pointer" : "default", userSelect: "none" }}>
      {showMark && <div style={{ marginBottom: 2 }}><KeyMark size={mk} color={markColor} /></div>}
      <div style={{ fontSize: wm, fontWeight: 300, letterSpacing: "0.42em", color, lineHeight: 1, paddingLeft: "0.42em" }}>DUNE</div>
      <div style={{ display: "flex", gap: "1.4em", alignItems: "center", paddingLeft: "0.42em" }}>
        <span style={{ fontSize: wm * 0.30, fontWeight: 600, letterSpacing: "0.34em", color: sub }}>REAL ESTATE</span>
        <span style={{ fontSize: wm * 0.30, fontWeight: 500, letterSpacing: "0.2em", color: markColor }}>2025</span>
      </div>
    </div>
  );
}

// ---- Icon set (stroke, currentColor) ----
const ic = (paths, vb = "0 0 24 24") => ({ size = 20, stroke = 1.6, style, className }) => (
  <svg width={size} height={size} viewBox={vb} fill="none" stroke="currentColor" strokeWidth={stroke}
       strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true">{paths}</svg>
);

const IconSearch   = ic(<><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></>);
const IconBed      = ic(<><path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" /><path d="M3 18h18" /><path d="M7 10V7a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v3" /></>);
const IconArea     = ic(<><rect x="3" y="3" width="18" height="18" rx="1" /><path d="M3 9h4M3 15h4M9 3v4M15 3v4" /></>);
const IconFloor    = ic(<><path d="M4 21V8l8-5 8 5v13" /><path d="M4 13h16M4 17h16M9 21V13M15 21V13" /></>);
const IconPin      = ic(<><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12Z" /><circle cx="12" cy="9" r="2.5" /></>);
const IconArrow    = ic(<><line x1="5" y1="12" x2="19" y2="12" /><polyline points="13 6 19 12 13 18" /></>);
const IconArrowDR  = ic(<><line x1="7" y1="17" x2="17" y2="7" /><polyline points="9 7 17 7 17 15" /></>);
const IconClose    = ic(<><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>);
const IconHeart    = ic(<><path d="M12 20s-7-4.6-9.3-9C1.2 8.3 2.5 5 6 5c2 0 3.2 1.2 4 2.4C10.8 6.2 12 5 14 5c3.5 0 4.8 3.3 3.3 6-2.3 4.4-9.3 9-9.3 9Z" /></>);
const IconPhone    = ic(<><path d="M5 3h3l2 5-2.5 1.5a12 12 0 0 0 6 6L19 14l2 5v3a1 1 0 0 1-1 1A17 17 0 0 1 3 6a1 1 0 0 1 1-1Z" /></>);
const IconMenu     = ic(<><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>);
const IconChevD    = ic(<><polyline points="6 9 12 15 18 9" /></>);
const IconCheck    = ic(<><polyline points="4 12 9 17 20 6" /></>);
const IconCalc     = ic(<><rect x="5" y="3" width="14" height="18" rx="2" /><line x1="9" y1="7" x2="15" y2="7" /><path d="M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01" /></>);
const IconShield   = ic(<><path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3Z" /><polyline points="9 12 11 14 15 9" /></>);
const IconKeyhole  = ic(<><circle cx="12" cy="9" r="3.5" /><path d="M10.5 12L9 20h6l-1.5-8" /></>);
const IconGlobe    = ic(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>);
const IconStar     = ic(<><polygon points="12 3 14.6 9 21 9.6 16 14 17.6 20.6 12 17 6.4 20.6 8 14 3 9.6 9.4 9" /></>);
const IconSliders  = ic(<><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="17" x2="20" y2="17" /><circle cx="9" cy="7" r="2.4" fill="currentColor" stroke="none" /><circle cx="15" cy="17" r="2.4" fill="currentColor" stroke="none" /></>);
const IconCamera   = ic(<><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><circle cx="12" cy="12.5" r="3.2" /></>);
const IconMail     = ic(<><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" /></>);

Object.assign(window, {
  KeyMark, Logo,
  IconSearch, IconBed, IconArea, IconFloor, IconPin, IconArrow, IconArrowDR,
  IconClose, IconHeart, IconPhone, IconMenu, IconChevD, IconCheck, IconCalc,
  IconShield, IconKeyhole, IconGlobe, IconStar, IconSliders, IconCamera, IconMail,
});
