import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';

import LogoBlockVIA from '../assets/blockvia.png';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isMobileMenuOpen]);

  const navLinks = [
    { name: 'Sential Engine', path: '/#sential' },
    { name: 'Architecture', path: '/#architecture' },
    { name: 'FAQ', path: '/#faq' }
  ];

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 py-[12px] flex items-center justify-between px-4 md:px-8 transition-all duration-500 backdrop-blur-[20px] bg-[rgba(7,9,15,0.80)] ${scrolled ? 'border-b border-[var(--border-subtle)] shadow-[0_4px_30px_rgba(0,0,0,0.5)]' : 'border-b border-transparent'}`}>
        
        {/* LOGO */}
        <Link to="/" className="flex items-center group z-[60]" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="flex items-center justify-center">
             <img 
               src={LogoBlockVIA} 
               alt="BlockVIA" 
               style={{ width: '10vw', minWidth: '40px', maxWidth: '80px', height: '10vh', minHeight: '40px', maxHeight: '80px', objectFit: 'contain' }} 
               className="group-hover:scale-110 group-hover:-rotate-2 transition-transform duration-[var(--dur-default)] drop-shadow-[0_0_15px_rgba(0,194,255,0.2)]" 
             />
          </div>
        </Link>

        {/* DESKTOP LINKS */}
        <div className="hidden md:flex items-center gap-[32px]">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path.replace('/#', '#');
            return (
              <a key={link.name} href={link.path} className={`relative text-[14px] font-medium transition-all duration-300 hover:-translate-y-[2px] ${isActive ? 'text-[var(--text-1)]' : 'text-[var(--text-2)] hover:text-[var(--accent)]'}`}>
                {link.name}
                {isActive && <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-[4px] h-[4px] rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />}
              </a>
            );
          })}
        </div>

        {/* DESKTOP CTAS */}
        <div className="hidden md:flex items-center gap-[24px]">
          <Link to="/scanner" className="relative group overflow-hidden bg-[var(--bg-surface-2)] border border-[var(--border-default)] text-[var(--text-1)] text-[13px] font-semibold px-[20px] py-[10px] rounded-[10px] transition-all duration-500 hover:border-[var(--accent)] hover:shadow-[0_0_25px_rgba(0,194,255,0.3)] active:scale-[0.95]">
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-[rgba(0,194,255,0.2)] to-transparent -translate-x-full group-hover:animate-shimmer"></div>
            <span className="relative z-10 whitespace-nowrap flex items-center gap-2">Launch Engine <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" /></span>
          </Link>
        </div>

        {/* MOBILE HAMBURGER TOGGLE */}
        <button 
          className="md:hidden relative z-[60] text-[var(--text-1)] p-2 -mr-2 transition-transform duration-300 hover:scale-110 active:scale-95"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X size={28} className="text-[var(--accent)]" /> : <Menu size={28} />}
        </button>
      </nav>

      {/* MOBILE OVERLAY */}
      <div className={`fixed inset-0 bg-[rgba(7,9,15,0.98)] backdrop-blur-3xl z-[50] flex flex-col pt-[120px] px-6 transition-all duration-500 md:hidden ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto translate-y-0' : 'opacity-0 pointer-events-none -translate-y-8'}`}>
        
        <div className="flex flex-col gap-6 mt-8">
          {navLinks.map((link, idx) => (
            <a 
              key={link.name} 
              href={link.path} 
              onClick={() => setIsMobileMenuOpen(false)}
              className={`text-[32px] font-display font-medium tracking-tight border-b border-[var(--border-subtle)] pb-4 transition-all duration-500 ${isMobileMenuOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}
              style={{ 
                transitionDelay: isMobileMenuOpen ? `${idx * 100}ms` : '0ms',
                color: location.pathname === link.path.replace('/#', '#') ? 'var(--accent)' : 'var(--text-1)' 
              }}
            >
              {link.name}
            </a>
          ))}
        </div>

        <div className={`mt-auto pb-12 flex flex-col gap-4 w-full transition-all duration-700 delay-300 ${isMobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <Link onClick={() => setIsMobileMenuOpen(false)} to="/scanner" className="w-full bg-[var(--text-1)] text-[var(--bg-base)] text-[16px] font-bold px-[24px] py-[18px] rounded-[12px] text-center shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-95 transition-transform flex items-center justify-center gap-2">
            Launch Engine Free <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </>
  );
}
