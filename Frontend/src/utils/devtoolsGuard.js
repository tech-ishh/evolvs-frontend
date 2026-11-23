
const params = new URLSearchParams(window.location.search);
if (params.get('owner') === 'your-long-random-secret') {
  try { window.localStorage.setItem('evolv-owner', '1'); } catch { /* ignore */ }
}
const isOwner = () => {
  try {
    return window.localStorage.getItem('evolv-owner') === '1';
  } catch {
    return false;
  }
};

export function enableDevtoolsGuard() {
  // Never block in development, and never block you (the owner)
  if (import.meta.env.DEV || isOwner()) return () => {};

  const onContextMenu = (e) => e.preventDefault();

  const onKeyDown = (e) => {
    const key = e.key.toLowerCase();
    const ctrlOrCmd = e.ctrlKey || e.metaKey;

    const blocked =
      e.key === 'F12' ||
      (ctrlOrCmd && e.shiftKey && ['i', 'j', 'c'].includes(key)) || // Inspect / Console / Picker
      (e.metaKey && e.altKey && ['i', 'j', 'c'].includes(key)) ||   // Mac shortcuts
      (ctrlOrCmd && key === 'u') ||                                 // View source
      (ctrlOrCmd && key === 's');                                   // Save page

    if (blocked) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  document.addEventListener('contextmenu', onContextMenu);
  document.addEventListener('keydown', onKeyDown, true);

  return () => {
    document.removeEventListener('contextmenu', onContextMenu);
    document.removeEventListener('keydown', onKeyDown, true);
  };
}