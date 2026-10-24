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
