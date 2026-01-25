import React, { useEffect, useRef, useState } from 'react';
import designSystem from '../../designSystem';
import { Share2, ExternalLink, Globe } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { t } from '../../utils/i18n';
import VersionDisplay from '../ui/VersionDisplay';

interface HeaderProps {
  title: string;
  onSidebarToggle: () => void;
  sidebarCollapsed: boolean;
  onMobileSidebarToggle: () => void;
  isMobile: boolean;
  restaurant: any;
}

const Header: React.FC<HeaderProps> = ({ title, onSidebarToggle, onMobileSidebarToggle, isMobile, restaurant }) => {
  const isDemoUser = false; // Demo functionality removed
  const publicMenuLink = restaurant?.publicMenuLink !== false;
  const publicOrderLink = restaurant?.publicOrderLink !== false;
  const { language, setLanguage, supportedLanguages } = useLanguage();
  const [langDropdownOpen, setLangDropdownOpen] = React.useState(false);
  const langSwitcherRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (langSwitcherRef.current && !langSwitcherRef.current.contains(e.target as Node)) {
        setLangDropdownOpen(false);
      }
    }
    if (langDropdownOpen) {
      document.addEventListener('mousedown', handleClick);
    } else {
      document.removeEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [langDropdownOpen]);

  const menuLinks = React.useMemo(() => {
    if (!restaurant?.id) return [];
    const links = [];
    if (isDemoUser) {
      if (publicMenuLink) {
        links.push({
          label: t('menu_link', language),
          icon: <ExternalLink size={18} className="mr-2" />, href: `/demo-public-menu/${restaurant.id}`, variant: 'outline',
        });
      }
      if (publicOrderLink) {
        links.push({
          label: t('order_link', language),
          icon: <Share2 size={18} className="mr-2" />, href: `/demo-public-order/${restaurant.id}`, variant: 'gold',
        });
      }
    } else {
      if (publicMenuLink) {
        links.push({
          label: t('menu_link', language),
          icon: <ExternalLink size={18} className="mr-2" />, href: `/public-menu/${restaurant.id}`, variant: 'outline',
        });
      }
      if (publicOrderLink) {
        links.push({
          label: t('order_link', language),
          icon: <Share2 size={18} className="mr-2" />, href: `/public-order/${restaurant.id}`, variant: 'gold',
        });
      }
    }
    return links;
  }, [restaurant, isDemoUser, publicMenuLink, publicOrderLink, language]);

  // For mobile slideshow
  const [] = useState(0);
  const slideInterval = useRef<NodeJS.Timeout | null>(null);
  const [] = useState(false);
  const [toggleHover, setToggleHover] = useState(false);

  useEffect(() => {
    // No slideshow needed anymore, but keep effect for future if needed
    return () => {
      if (slideInterval.current) clearInterval(slideInterval.current);
    };
  }, []);

  // Button styles
  const menuButtonBase = {
    height: 40,
    minWidth: 120,
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 16,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 20px',
    transition: 'background 0.15s, color 0.15s',
    boxShadow: 'none',
    outline: 'none',
    borderWidth: 1,
    borderStyle: 'solid',
    cursor: 'pointer',
    marginLeft: 12,
    marginRight: 0,
    gap: 8,
    userSelect: 'none',
  } as React.CSSProperties;

  // Simple outlined split box icon for sidebar toggle
  const ToggleIcon = (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        display: 'block',
        stroke: toggleHover ? designSystem.colors.accent : designSystem.colors.text,
        strokeWidth: 2,
        transition: 'stroke 0.15s',
      }}
    >
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" fill="none" />
      <line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" />
    </svg>
  );

  return (
    <header
      className="sticky top-0 z-50 w-full flex items-center justify-between px-4 py-3 shadow border-b"
      style={{ background: designSystem.colors.white, borderColor: designSystem.colors.borderLightGray }}
    >
      {/* Left: Toggle, name */}
      <div className="flex items-center min-w-0" style={{ flexBasis: '0 0 auto', flexGrow: 0, flexShrink: 1 }}>
        {/* Sidebar toggle */}
        <button
          className="mr-2 p-2 rounded-md transition md:block"
          style={{
            background: toggleHover ? designSystem.colors.accent : 'transparent',
            color: toggleHover ? designSystem.colors.white : designSystem.colors.text,
            border: 'none',
          }}
          onClick={isMobile ? onMobileSidebarToggle : onSidebarToggle}
          aria-label="Toggle sidebar"
          onMouseEnter={() => setToggleHover(true)}
          onMouseLeave={() => setToggleHover(false)}
        >
          {ToggleIcon}
        </button>
        <div className="flex flex-col min-w-0">
          <span
            className="font-bold text-base"
            style={{
              color: designSystem.colors.text,
              ...(isMobile ? {
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                textAlign: 'left',
                display: 'block',
                width: '100%',
              } : {
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'block',
                width: '100%',
              })
            }}
          >
            {t('restaurant_management', language)}
          </span>
          {/* Version display */}
          <div className="mt-1">
            <VersionDisplay variant="text" className="text-xs" />
          </div>
        </div>
      </div>
      {/* Center: Page title (take up available space, no extra margin) */}
      <div className="flex items-center min-w-0 flex-1 justify-center">
        <span
          className="font-bold text-lg truncate"
          style={{
            color: designSystem.colors.text,
            ...(isMobile ? {
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              textAlign: 'center',
              display: 'block',
              width: '100%',
            } : {})
          }}
        >
          {title}
        </span>
      </div>
      {/* Right: Menu/Order links or mobile slideshow + Language Switcher */}
      <div style={{ flexBasis: '0 0 auto', flexGrow: 0, flexShrink: 1, minWidth: isMobile ? undefined : 180 }}>
        {isMobile ? (
          <div className="flex flex-col w-full items-stretch justify-center" style={{ minWidth: 120 }}>
            <div className="relative w-full h-12 flex items-center justify-center" style={{ minWidth: 120, justifyContent: 'center', display: 'flex' }}>
              {menuLinks.filter(link => link.variant === 'gold').map((link) => {
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    style={{
                      ...menuButtonBase,
                      fontSize: 'clamp(11px, 3vw, 14px)',
                      padding: '0 6px',
                      position: 'static',
                      width: '90%',
                      height: '80%',
                      background: designSystem.colors.accent,
                      color: designSystem.colors.text,
                      borderColor: designSystem.colors.accent,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                      margin: '0 auto',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = designSystem.colors.text;
                      (e.currentTarget as HTMLElement).style.color = designSystem.colors.white;
                      (e.currentTarget as HTMLElement).style.borderColor = designSystem.colors.text;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = designSystem.colors.accent;
                      (e.currentTarget as HTMLElement).style.color = designSystem.colors.text;
                      (e.currentTarget as HTMLElement).style.borderColor = designSystem.colors.accent;
                    }}
                  >
                    {link.icon}
                    {link.label}
                  </a>
                );
              })}
            </div>
            {/* Language Switcher on a new row, right-aligned */}
            <div className="flex w-full justify-end mt-2">
              <div
                ref={langSwitcherRef}
                className="relative"
              >
                <button
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-medium text-gray-700"
                  style={{ minWidth: 80 }}
                  aria-haspopup="listbox"
                  aria-expanded={langDropdownOpen}
                  aria-label="Select language"
                  onClick={() => setLangDropdownOpen(v => !v)}
                  tabIndex={0}
                  type="button"
                >
                  <Globe size={18} className="text-gray-400 mr-1" />
                  <span className="capitalize">{supportedLanguages.find(l => l.code === language)?.label || language}</span>
                  <svg className={`ml-1 w-4 h-4 transition-transform ${langDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {langDropdownOpen && (
                  <ul
                    className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 animate-fade-in"
                    role="listbox"
                    tabIndex={-1}
                  >
                    {supportedLanguages.map(lang => (
                      <li
                        key={lang.code}
                        className={`px-4 py-2 cursor-pointer text-gray-700 hover:bg-accent/10 rounded-lg transition-all ${lang.code === language ? 'font-semibold bg-accent/20' : ''}`}
                        role="option"
                        aria-selected={lang.code === language}
                        onClick={() => { setLanguage(lang.code); setLangDropdownOpen(false); }}
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setLanguage(lang.code); setLangDropdownOpen(false); } }}
                      >
                        {lang.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {menuLinks.map((link) => {
              const isGold = link.variant === 'gold';
              return (
                <a
                  key={link.label}
                  href={link.href}
                  style={{
                    ...menuButtonBase,
                    background: isGold ? designSystem.colors.accent : designSystem.colors.white,
                    color: isGold ? designSystem.colors.text : designSystem.colors.text,
                    borderColor: isGold ? designSystem.colors.accent : designSystem.colors.borderLightGray,
                  }}
                  onMouseEnter={e => {
                    if (!isGold) {
                      (e.currentTarget as HTMLElement).style.background = designSystem.colors.accent;
                      (e.currentTarget as HTMLElement).style.color = designSystem.colors.text;
                      (e.currentTarget as HTMLElement).style.borderColor = designSystem.colors.accent;
                    }
                    if (isGold) {
                      (e.currentTarget as HTMLElement).style.background = designSystem.colors.text;
                      (e.currentTarget as HTMLElement).style.color = designSystem.colors.white;
                      (e.currentTarget as HTMLElement).style.borderColor = designSystem.colors.text;
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isGold) {
                      (e.currentTarget as HTMLElement).style.background = designSystem.colors.white;
                      (e.currentTarget as HTMLElement).style.color = designSystem.colors.text;
                      (e.currentTarget as HTMLElement).style.borderColor = designSystem.colors.borderLightGray;
                    }
                    if (isGold) {
                      (e.currentTarget as HTMLElement).style.background = designSystem.colors.accent;
                      (e.currentTarget as HTMLElement).style.color = designSystem.colors.text;
                      (e.currentTarget as HTMLElement).style.borderColor = designSystem.colors.accent;
                    }
                  }}
                >
                  {link.icon}
                  {link.label}
                </a>
              );
            })}
            {/* Modern Language Switcher */}
            <div
              ref={langSwitcherRef}
              className="relative ml-2"
            >
              <button
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm font-medium text-gray-700"
                style={{ minWidth: 80 }}
                aria-haspopup="listbox"
                aria-expanded={langDropdownOpen}
                aria-label="Select language"
                onClick={() => setLangDropdownOpen(v => !v)}
                tabIndex={0}
                type="button"
              >
                <Globe size={18} className="text-gray-400 mr-1" />
                <span className="capitalize">{supportedLanguages.find(l => l.code === language)?.label || language}</span>
                <svg className={`ml-1 w-4 h-4 transition-transform ${langDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {langDropdownOpen && (
                <ul
                  className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 animate-fade-in"
                  role="listbox"
                  tabIndex={-1}
                >
                  {supportedLanguages.map(lang => (
                    <li
                      key={lang.code}
                      className={`px-4 py-2 cursor-pointer text-gray-700 hover:bg-accent/10 rounded-lg transition-all ${lang.code === language ? 'font-semibold bg-accent/20' : ''}`}
                      role="option"
                      aria-selected={lang.code === language}
                      onClick={() => { setLanguage(lang.code); setLangDropdownOpen(false); }}
                      tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setLanguage(lang.code); setLangDropdownOpen(false); } }}
                    >
                      {lang.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header; 