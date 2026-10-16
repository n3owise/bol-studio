import { useCallback, useEffect, useState } from 'react';

/**
 * The editor's light/dark theme: the state, the navbar switch's two entry
 * points, the attribute/class sync on <html>, and the Cmd/Ctrl+Shift+D shortcut.
 * Lifted out of Studio unchanged; Studio calls it where these hooks used to sit.
 */
export function useStudioTheme() {
  /**
   * Light unless this browser has been told otherwise.
   *
   * The machine's preference used to decide it. It does not any more: the gate
   * in front of this is light unconditionally, so a dark OS meant the page
   * changed colour at the moment of signing in. The switch in the navbar still
   * decides, and now sticks — see persistTheme.
   *
   * Mirrors the boot script in index.html, which has to make the same call
   * before any of this is parsed. The two must agree or the first paint is the
   * wrong theme.
   */
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'),
  );

  /**
   * What the navbar switch calls.
   *
   * It was `setTheme`, which is state and nothing else — so the switch changed
   * the page and the choice was gone on the next load, because the boot script
   * reads a key nobody was writing. The toggler handles the attribute, the
   * class and the meta colour itself in controlled mode but deliberately leaves
   * persistence to its parent, and this is the parent.
   */
  const persistTheme = useCallback((next: 'light' | 'dark') => {
    setTheme(next);
    try { localStorage.setItem('bol_theme', next); } catch { /* private window */ }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('bol_theme', next);
      document.documentElement.setAttribute('data-theme', next);
      if (next === 'dark') {
        document.documentElement.classList.add('theme-dark');
      } else {
        document.documentElement.classList.remove('theme-dark');
      }
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', next === 'dark' ? '#111215' : '#ffffff');
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('theme-dark');
    } else {
      document.documentElement.classList.remove('theme-dark');
    }
  }, [theme]);

  useEffect(() => {
    const handleThemeKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        const toggler = document.querySelector<HTMLButtonElement>('.theme-toggle-btn, .animated-theme-toggler');
        if (toggler) {
          toggler.click();
        } else {
          toggleTheme();
        }
      }
    };
    window.addEventListener('keydown', handleThemeKey);
    return () => window.removeEventListener('keydown', handleThemeKey);
  }, [toggleTheme]);

  return { theme, persistTheme, toggleTheme };
}
