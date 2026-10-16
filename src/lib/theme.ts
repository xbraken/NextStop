export type ThemePreference = 'system' | 'light' | 'dark'

export const THEME_STORAGE_KEY = 'nextstop-theme'

const MAP_STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty'
const MAP_STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark'

// Runs inline in <head> before first paint so the page never flashes the
// wrong theme. Also follows OS changes while the preference is "system".
export const THEME_INIT_SCRIPT = `(function(){try{
var k=${JSON.stringify(THEME_STORAGE_KEY)};
var m=window.matchMedia('(prefers-color-scheme: dark)');
function apply(){var p;try{p=localStorage.getItem(k)}catch(e){}
var d=p==='dark'||(p!=='light'&&m.matches);
document.documentElement.classList.toggle('dark',d);}
apply();m.addEventListener('change',apply);
window.addEventListener('storage',function(e){if(e.key===k)apply()});
}catch(e){}})();`

export function isDarkTheme(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
}

export function mapStyleUrl(): string {
  return isDarkTheme() ? MAP_STYLE_DARK : MAP_STYLE_LIGHT
}

export function readThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {}
  return 'system'
}

export function applyThemePreference(pref: ThemePreference) {
  try {
    if (pref === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, pref)
  } catch {}
  const dark =
    pref === 'dark' ||
    (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}
