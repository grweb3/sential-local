import { Link } from 'react-router-dom';

export default function LegalFooter() {
  return (
    <div className="w-full text-center py-8 text-[11px] sm:text-[12px] text-[var(--text-3)] font-mono flex flex-col items-center gap-4 border-t border-[var(--border-subtle)] bg-transparent print:hidden mt-auto relative z-20">
      <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
        <Link to="/terms" className="hover:text-[var(--text-1)] hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] transition-all duration-300 uppercase tracking-widest font-bold">Terms of Service</Link>
        <span className="hidden sm:inline text-[var(--border-strong)]">|</span>
        <Link to="/privacy" className="hover:text-[var(--text-1)] hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] transition-all duration-300 uppercase tracking-widest font-bold">Privacy Policy</Link>
      </div>
      <div className="flex flex-col gap-2 items-center opacity-60 mt-2">
        <span className="hover:text-[var(--text-2)] transition-colors cursor-default">Contact: compliance@blockvia.xyz</span>
        <span className="hover:text-[var(--text-2)] transition-colors cursor-default">BlockVIA Pvt Ltd. | Hyderabad, Telangana, India</span>
      </div>
    </div>
  );
}