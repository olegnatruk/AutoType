import { TypingSession, CommandController, validateDraft } from './core.js';
import { inspectTarget } from './target.js';

const storageReady = chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
const inspect = async (tabId, action, token, multiline) => {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId }, func: inspectTarget, args: [{ action, token, multiline }]
  });
  if (!result?.result) throw new Error('Cannot inspect the selected editor.');
  return result.result;
};

const driver = {
  async capture(tabId, token, multiline) {
    const result = await inspect(tabId, 'capture', token, multiline);
    if (!result.ok) throw new Error(result.error);
    return result;
  },
  attach: tabId => chrome.debugger.attach({ tabId }, '1.3'),
  async arm(tabId, token) {
    const result = await inspect(tabId, 'arm', token);
    if (!result.ok) throw new Error(result.error);
  },
  async check(tabId, token) {
    const result = await inspect(tabId, 'check', token);
    return result.ok;
  },
  async isActive(tabId) {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const win = await chrome.windows.getLastFocused();
    return Boolean(win.focused && tab?.id === tabId);
  },
  disarm: (tabId, token) => inspect(tabId, 'disarm', token),
  detach: tabId => chrome.debugger.detach({ tabId }),
  async send(tabId, character, kind) {
    const target = { tabId };
    if (character === '\n' && kind === 'docs') {
      await chrome.debugger.sendCommand(target, 'Input.dispatchKeyEvent', {
        type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r', modifiers: 0
      });
      await chrome.debugger.sendCommand(target, 'Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers: 0
      });
    } else if (/^[\x20-\x7e]$/u.test(character)) {
      // A char event enters printable text without introducing shortcut modifiers.
      await chrome.debugger.sendCommand(target, 'Input.dispatchKeyEvent', {
        type: 'char', text: character, unmodifiedText: character, key: character, modifiers: 0
      });
    } else {
      // Unicode, literal tabs, and ordinary-editor line breaks never send Tab/Enter shortcuts.
      await chrome.debugger.sendCommand(target, 'Input.insertText', { text: character });
    }
  }
};

let persistenceQueue = Promise.resolve();
let publishedPhase;
const publish = state => {
  chrome.action.setBadgeText({ text: state.phase === 'typing' ? 'ON' : state.phase === 'paused' ? 'Ⅱ' : state.phase === 'error' ? '!' : '' }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ color: state.phase === 'error' ? '#9c3827' : '#324c41' }).catch(() => {});
  chrome.runtime.sendMessage({ type: 'SESSION_STATE', state }).catch(() => {});
  // Debugger keeps active runs alive. Persist only transitions; paused runs must
  // survive worker suspension, but never survive a browser restart.
  if (state.phase !== publishedPhase || state.phase === 'paused') {
    publishedPhase = state.phase;
    const checkpoint = session.checkpoint();
    persistenceQueue = persistenceQueue.then(() => checkpoint
      ? chrome.storage.session.set({ checkpoint }) : chrome.storage.session.remove('checkpoint'))
      .catch(() => {});
  }
};
const session = new TypingSession({
  driver, publish,
  getDraft: async () => { await storageReady; return (await chrome.storage.local.get('draft')).draft || ''; }
});
const ready = storageReady.then(async () => {
  const { checkpoint } = await chrome.storage.session.get('checkpoint');
  session.restore(checkpoint);
  publish(session.snapshot());
});

let saveQueue = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === 'TARGET_INTERRUPTED') {
    if (sender.tab?.id && sender.id === chrome.runtime.id) {
      void ready.then(() => session.interrupt(sender.tab.id, message.token, message.reason));
    }
    return false;
  }
  // Web pages/content scripts cannot read saved drafts or control the popup API.
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) return false;
  const handle = async () => {
    await ready;
    switch (message?.type) {
      case 'GET_STATE':
        await saveQueue;
        return { draft: (await chrome.storage.local.get('draft')).draft || '', state: session.snapshot(), commands: await chrome.commands.getAll() };
      case 'SAVE_DRAFT': {
        validateDraft(message.text);
        const write = saveQueue.then(() => chrome.storage.local.set({ draft: message.text }));
        saveQueue = write.catch(() => {});
        await write;
        return {};
      }
      case 'CLEAR_DRAFT': {
        commands.cancel();
        await session.stop('Draft cleared. Paste a new passage when ready.');
        const removal = saveQueue.then(() => chrome.storage.local.remove('draft'));
        saveQueue = removal.catch(() => {});
        await removal;
        return {};
      }
      case 'STOP': commands.cancel(); await session.stop(); return {};
      default: throw new Error('Unknown popup request.');
    }
  };
  handle().then(data => respond({ ok: true, ...data }), error => respond({ ok: false, error: error.message }));
  return true;
});

const commands = new CommandController({
  session, ready, saved: () => saveQueue, isActive: driver.isActive,
  currentTab: async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]
});
chrome.commands.onCommand.addListener((command, tab) => { void commands.handle(command, tab); });

chrome.tabs.onActivated.addListener(({ tabId }) => {
  if (commands.pending && tabId !== commands.pending.tab?.id) commands.cancel();
  void ready.then(() => {
  if (tabId !== session.state.tabId) void session.pause('Tab changed. Return to the original editor to resume.');
}); });
chrome.windows.onFocusChanged.addListener(windowId => {
  commands.cancel();
  void ready.then(() => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) void session.pause('Chrome lost focus. Return to the original editor to resume.');
  else if (session.state.phase === 'typing') void driver.isActive(session.state.tabId).then(active => active || session.pause('Window changed. Return to the original editor to resume.'));
}); });
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if ((change.status === 'loading' || change.url) && (!commands.pending?.tab || tabId === commands.pending.tab.id)) commands.cancel();
  void ready.then(() => {
  if (tabId === session.state.tabId && (change.status === 'loading' || change.url)) void session.stop('Page changed. Click an editor and start a new run.');
}); });
chrome.tabs.onRemoved.addListener(tabId => {
  if (!commands.pending?.tab || tabId === commands.pending.tab.id) commands.cancel();
  void ready.then(() => {
  if (tabId === session.state.tabId) void session.stop('The destination tab closed.');
}); });
chrome.debugger.onDetach.addListener(({ tabId }) => {
  // Inspect attachment state at event receipt, before queuing. A queued event
  // from our own detach must not cancel a later resume attachment.
  if (session.attached) void session.disconnected(tabId);
});
