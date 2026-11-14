// Small inline SVG icon set (LinkedIn-style outline icons)
const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const HomeIcon = (p) => <svg {...base} {...p}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>;
export const OngoingIcon = (p) => <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const ClosedIcon = (p) => <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.8" /></svg>;
export const BellIcon = (p) => <svg {...base} {...p}><path d="M6 17V11a6 6 0 0112 0v6l1.5 2h-15z" /><path d="M10 21h4" /></svg>;
export const QueueIcon = (p) => <svg {...base} {...p}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h8M8 17h5" /></svg>;
export const StatsIcon = (p) => <svg {...base} {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
export const UpvoteIcon = ({ filled, ...p }) => <svg {...base} {...p} fill={filled ? 'currentColor' : 'none'}><path d="M12 4l8 9h-5v7H9v-7H4z" /></svg>;
export const CommentIcon = (p) => <svg {...base} {...p}><path d="M4 5h16v11H9l-5 4z" /></svg>;
export const ShareIcon = (p) => <svg {...base} {...p}><path d="M14 4l7 7-7 7v-4c-6 0-9 2-11 5 1-6 4-10 11-10z" /></svg>;
export const PlusIcon = (p) => <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>;
export const CameraIcon = (p) => <svg {...base} {...p}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>;
export const PinIcon = (p) => <svg {...base} {...p}><path d="M12 21s7-6.2 7-11.2A7 7 0 005 9.8C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.8" r="2.5" /></svg>;
