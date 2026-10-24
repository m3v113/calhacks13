const p = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const InboxIcon = () => (
  <svg {...p}><path d="M3 13h5l1.5 3h5L16 13h5" /><path d="M5 5h14l2 8v6H3v-6z" /></svg>
);
export const HubIcon = () => (
  <svg {...p}><circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>
);
export const PanelIcon = () => (
  <svg {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M15 4v16" /></svg>
);
export const PlusIcon = () => (
  <svg {...p}><path d="M12 5v14M5 12h14" /></svg>
);
export const NoteIcon = () => (
  <svg {...p}><path d="M5 4h14v16H5z" /><path d="M9 9h6M9 13h6M9 17h3" /></svg>
);
export const LinkIcon = () => (
  <svg {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
);
export const ImageIcon = () => (
  <svg {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></svg>
);
export const DocIcon = () => (
  <svg {...p}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></svg>
);
