// Self-contained: Chrome serializes this function into the isolated page world.
export function inspectTarget({ action, token, multiline = false }) {
  const key = '__autotypeGuardV1';
  const previous = window[key];
  if (action === 'disarm') {
    if (previous?.token === token) previous.armed = false;
    return { ok: true };
  }

  const resolve = () => {
    let doc = document;
    let element = doc.activeElement;
    const documents = [doc];
    let docsFrame = false;
    for (let depth = 0; depth < 20; depth++) {
      if (element?.tagName === 'IFRAME') {
        docsFrame ||= element.classList.contains('docs-texteventtarget-iframe');
        try {
          const child = element.contentDocument;
          if (!child) return { error: 'This embedded editor is inaccessible. Use a field in the main page.' };
          doc = child;
          documents.push(doc);
          element = doc.activeElement;
        } catch { return { error: 'This embedded editor is inaccessible. Use a field in the main page.' }; }
      } else if (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
      else break;
    }
    return { element, doc, documents, docsFrame };
  };

  const current = resolve();
  if (action === 'check' || action === 'arm') {
    if (!previous || previous.token !== token) return { ok: false, error: 'The original page changed. Stop and start a new run.' };
    const matches = !current.error && current.element === previous.element && previous.element.isConnected
      && document.hasFocus() && document.visibilityState === 'visible'
      && !previous.element.disabled && !previous.element.readOnly
      && !previous.element.closest('[aria-disabled="true"], [aria-readonly="true"]')
      && ((previous.kind === 'docs' && current.docsFrame && previous.element.isContentEditable)
        || (previous.kind !== 'docs' && previous.element.isContentEditable) || previous.element.tagName === 'TEXTAREA'
        || (previous.element.tagName === 'INPUT' && ['text', 'search', 'email', 'url', 'tel'].includes(previous.element.type)));
    if (!matches) return { ok: false, error: 'Click the original editable field before using the shortcut.' };
    if (action === 'arm') previous.armed = true;
    return { ok: matches && previous.armed };
  }

  previous?.dispose();
  if (current.error) return { ok: false, error: current.error };
  const { element, documents, docsFrame } = current;
  if (!element || !document.hasFocus()) return { ok: false, error: 'Click the destination text field before using the shortcut.' };
  if (element.disabled || element.readOnly || element.closest('[aria-disabled="true"], [aria-readonly="true"]')) {
    return { ok: false, error: 'The selected field is read-only or disabled.' };
  }
  const docsPage = location.hostname === 'docs.google.com' && /^\/document\/d\//u.test(location.pathname);
  let kind;
  if (docsPage && docsFrame && element.isContentEditable) kind = 'docs';
  else if (element.tagName === 'TEXTAREA') kind = 'textarea';
  else if (element.tagName === 'INPUT' && ['text', 'search', 'email', 'url', 'tel'].includes(element.type)) kind = 'input';
  else if (element.isContentEditable) kind = 'editable';
  else return { ok: false, error: element.type === 'password' ? 'Password fields are unsupported.' : 'Click an editable text field or the Google Docs document body.' };
  if (multiline && kind === 'input') return { ok: false, error: 'This passage contains line breaks. Choose a multiline editor or remove the line breaks.' };

  const guard = { token, element, kind, armed: false };
  const interrupt = reason => {
    if (!guard.armed) return;
    guard.armed = false; // Block the next character before the worker sees the message.
    chrome.runtime.sendMessage({ type: 'TARGET_INTERRUPTED', token, reason }).catch(() => {});
  };
  const onPointer = () => interrupt('Cursor moved. Click the original editor and use the shortcut to resume.');
  const onFocus = () => { if (resolve().element !== element) interrupt('Focus changed. Use the shortcut in the original editor to resume.'); };
  const onVisibility = () => { if (document.visibilityState !== 'visible') interrupt('Tab changed. Return to the original editor to resume.'); };
  const onBlur = () => interrupt('The editor lost focus. Click it and use the shortcut to resume.');
  const onKey = event => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Backspace', 'Delete', 'Tab', 'Escape'].includes(event.key)) {
      interrupt('Keyboard input moved the cursor. Click the original editor and use the shortcut to resume.');
    }
  };
  for (const doc of documents) {
    doc.addEventListener('pointerdown', onPointer, true);
    doc.addEventListener('focusin', onFocus, true);
    doc.addEventListener('keydown', onKey, true);
  }
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', onBlur);
  guard.dispose = () => {
    guard.armed = false;
    for (const doc of documents) {
      doc.removeEventListener('pointerdown', onPointer, true);
      doc.removeEventListener('focusin', onFocus, true);
      doc.removeEventListener('keydown', onKey, true);
    }
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('blur', onBlur);
  };
  window[key] = guard;
  return { ok: true, kind };
}
