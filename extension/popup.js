import { estimateDuration, segmentText } from './core.js';

const $ = id => document.getElementById(id);
const draft = $('draft');
let saving = Promise.resolve();
let revision = 0;
let localEdits = false;

function duration(ms) {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}
function updateDraftDetails() {
  const count = segmentText(draft.value).length;
  $('character-count').textContent = `${count.toLocaleString()} characters`;
  $('duration').textContent = `About ${duration(estimateDuration(draft.value))}`;
  $('clear').disabled = !draft.value;
}
async function request(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || 'AutoType did not respond. Reload the extension and try again.');
  return response;
}
function showError(error) {
  $('save-error').textContent = error.message;
  $('save-error').hidden = false;
}
function render(state) {
  document.body.dataset.phase = state.phase;
  const labels = { idle: 'Ready when you are', starting: 'Finding your cursor', typing: 'Typing your passage', paused: 'Paused at your cursor', completed: 'Passage finished', stopped: 'Typing stopped', error: 'Needs your attention' };
  $('session-title').textContent = labels[state.phase] || 'AutoType';
  $('session-message').textContent = state.message;
  $('progress').max = state.total || 1;
  $('progress').value = state.index;
  $('progress-label').textContent = state.total ? `${state.index.toLocaleString()} of ${state.total.toLocaleString()} characters` : 'No active passage';
  $('remaining').textContent = state.total && state.index < state.total ? `${duration(state.remainingMs)} left` : '';
  $('stop').disabled = !['typing', 'starting', 'paused'].includes(state.phase);
}

// Saving is serialized and begins on every input, not on a closing-popup debounce.
// Once sent, storage is owned by the worker and survives popup destruction.
draft.addEventListener('input', () => {
  localEdits = true;
  const version = ++revision;
  const text = draft.value;
  updateDraftDetails();
  $('save-status').textContent = 'Saving…';
  $('save-error').hidden = true;
  // Dispatch now; the worker serializes writes even if the popup closes immediately.
  const write = request({ type: 'SAVE_DRAFT', text });
  saving = write.catch(() => {});
  write.then(() => {
    if (version === revision) $('save-status').textContent = 'Saved';
  }, error => { if (version === revision) { $('save-status').textContent = 'Not saved'; showError(error); } });
});

$('stop').addEventListener('click', () => { request({ type: 'STOP' }).catch(showError); });
$('clear').addEventListener('click', async () => {
  $('clear').disabled = true;
  draft.disabled = true;
  try {
    await saving;
    await request({ type: 'CLEAR_DRAFT' });
    draft.value = '';
    ++revision;
    $('save-status').textContent = 'Cleared';
    $('save-error').hidden = true;
    updateDraftDetails();
  } catch (error) { showError(error); updateDraftDetails(); }
  finally { draft.disabled = false; }
});
$('shortcuts').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }).catch(showError);
});
chrome.runtime.onMessage.addListener(message => {
  if (message.type === 'SESSION_STATE') render(message.state);
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.draft && !localEdits) {
    draft.value = changes.draft.newValue || '';
    updateDraftDetails();
  }
});

try {
  const result = await request({ type: 'GET_STATE' });
  draft.value = result.draft;
  draft.disabled = false;
  $('save-status').textContent = result.draft ? 'Saved' : 'Empty';
  updateDraftDetails();
  render(result.state);
  for (const [command, id] of [['toggle-typing', 'toggle-shortcut'], ['stop-typing', 'stop-shortcut']]) {
    const shortcut = result.commands.find(item => item.name === command)?.shortcut;
    $(id).textContent = shortcut || 'Not assigned';
    if (!shortcut) $(id).title = 'Click Change shortcuts to assign this command.';
  }
} catch (error) {
  $('save-status').textContent = 'Unavailable';
  showError(error);
}
