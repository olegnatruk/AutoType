export const WPM = 75;
export const CHARACTER_MS = 60_000 / (WPM * 5);
export const MAX_DRAFT_LENGTH = 200_000;

export function segmentText(text) {
  // Browser text controls normalize CRLF to LF. Keep all other whitespace intact.
  return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    .segment(text.replace(/\r\n?/g, '\n'))].map(part => part.segment);
}

export function createSchedule(characters, random = Math.random) {
  if (!characters.length) return [];
  const weights = characters.map(character => {
    const punctuation = /[.!?\n]/u.test(character) ? 2.1 : /[,;:]/u.test(character) ? 1.5 : 1;
    return (0.75 + random() * 0.5) * punctuation;
  });
  const factor = characters.length * CHARACTER_MS / weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map(weight => weight * factor);
}

export function estimateDuration(text) {
  return segmentText(text).length * CHARACTER_MS;
}

export function validateDraft(text) {
  if (typeof text !== 'string') throw new Error('The draft must be plain text.');
  if (text.length > MAX_DRAFT_LENGTH) throw new Error('Keep the draft below 200,000 characters. Split longer passages into separate runs.');
  return text;
}

export function wait(ms, signal) {
  return new Promise(resolve => {
    if (signal?.aborted) return resolve();
    const finish = () => { clearTimeout(timer); signal?.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal?.addEventListener('abort', finish, { once: true });
  });
}

// Chrome command startup is cancellable independently of the input queue.
export class CommandController {
  constructor({ session, ready, saved, currentTab, isActive,
    schedule = (callback, ms) => setTimeout(callback, ms), unschedule = timer => clearTimeout(timer) }) {
    Object.assign(this, { session, ready, saved, currentTab, isActive, schedule, unschedule });
    this.pending = null;
  }

  cancel() {
    if (this.pending) this.unschedule(this.pending.timer);
    this.pending = null;
  }

  handle(command, tab) {
    if (command === 'stop-typing') {
      this.cancel();
      return this.ready.then(() => this.session.stop());
    }
    if (command !== 'toggle-typing' || this.pending) return;
    const pending = { tab };
    this.pending = pending;
    pending.timer = this.schedule(async () => {
      try {
        await this.ready;
        await this.saved();
        const original = pending.tab || await this.currentTab();
        if (this.pending !== pending || !original || !(await this.isActive(original.id))) return;
        if (this.pending !== pending) return;
        await this.session.toggle(original);
      } finally { if (this.pending === pending) this.pending = null; }
    }, 300);
  }
}

// Each action, including individual input dispatches, passes through one queue.
// Timers live outside it, so Stop never waits for an entire passage.
export class TypingSession {
  constructor({ driver, getDraft, publish = () => {}, sleep = wait, now = () => performance.now(), random = Math.random }) {
    Object.assign(this, { driver, getDraft, publish, sleep, now, random });
    this.queue = Promise.resolve();
    this.state = { phase: 'idle', index: 0, total: 0, message: 'Ready when you are.' };
    this.version = 0;
    this.attached = false;
  }

  enqueue(action) {
    const result = this.queue.then(action);
    this.queue = result.catch(() => {});
    return result;
  }

  snapshot() {
    const { phase, index, total, message, tabId } = this.state;
    return { phase, index, total, message, tabId, remainingMs: Math.max(0, total - index) * CHARACTER_MS };
  }

  checkpoint() {
    if (!['typing', 'paused', 'starting'].includes(this.state.phase)) return null;
    return { state: { ...this.state }, characters: this.characters, schedule: this.schedule,
      token: this.token, target: this.target };
  }

  restore(checkpoint) {
    if (!checkpoint) return;
    if (checkpoint.state?.phase !== 'paused') {
      this.state = { phase: 'error', index: 0, total: 0, message: 'A previous run was interrupted. Check the editor before starting a new run.' };
      return;
    }
    const { state, characters, schedule, token, target } = checkpoint;
    if (!Array.isArray(characters) || !Array.isArray(schedule) || characters.length !== schedule.length
      || !target?.kind || !token || !Number.isInteger(state.index) || state.index < 0 || state.index >= characters.length) return;
    Object.assign(this, { state, characters, schedule, token, target });
  }

  update(patch) {
    Object.assign(this.state, patch);
    this.publish(this.snapshot());
  }

  toggle(tab) {
    return this.enqueue(async () => {
      if (this.state.phase === 'typing') return this.pauseInternal('Paused. Click the same editor and use the shortcut to resume.');
      if (this.state.phase === 'paused') {
        if (tab?.id !== this.state.tabId) {
          return this.update({ message: 'Return to the original tab and editor to resume, or Stop to start elsewhere.' });
        }
        return this.activate();
      }
      try {
        const text = validateDraft(await this.getDraft());
        if (!text.length) throw new Error('Paste a passage into AutoType first.');
        if (!tab?.id || !/^https?:\/\//u.test(tab.url || '')) throw new Error('Open a website and click an editable field first. Browser pages and local files are unsupported.');
        this.characters = segmentText(text);
        this.schedule = createSchedule(this.characters, this.random);
        this.token = crypto.randomUUID();
        this.update({ phase: 'starting', index: 0, total: this.characters.length, tabId: tab.id, message: 'Checking your cursor…' });
        this.target = await this.driver.capture(tab.id, this.token, this.characters.includes('\n'));
        await this.activate();
      } catch (error) {
        await this.finish('error', error.message);
      }
    });
  }

  async activate() {
    const resuming = this.state.phase === 'paused';
    try {
      this.update({ phase: 'starting', message: resuming ? 'Resuming…' : 'Starting…' });
      if (!(await this.driver.isActive(this.state.tabId))) throw new Error('Keep the original tab and Chrome window focused.');
      await this.driver.attach(this.state.tabId);
      this.attached = true;
      await this.driver.arm(this.state.tabId, this.token);
      this.abort = new AbortController();
      const version = ++this.version;
      this.update({ phase: 'typing', message: 'Typing at a natural 75 WPM.' });
      void this.run(version).catch(error => this.enqueue(() => this.finish('error', error.message)));
    } catch (error) {
      if (resuming) await this.pauseInternal(`${error.message} Click the original editor and try the shortcut again.`);
      else await this.finish('error', error.message);
    }
  }

  async run(version) {
    let overhead = 0;
    while (version === this.version && this.state.phase === 'typing') {
      await this.sleep(Math.max(40, this.schedule[this.state.index] - overhead), this.abort.signal);
      const start = this.now();
      await this.enqueue(async () => {
        if (version !== this.version || this.state.phase !== 'typing') return;
        try {
          if (!(await this.driver.isActive(this.state.tabId)) || !(await this.driver.check(this.state.tabId, this.token))) {
            return this.pauseInternal('Focus changed. Click the original editor and use the shortcut to resume.');
          }
          await this.driver.send(this.state.tabId, this.characters[this.state.index], this.target.kind);
          this.update({ index: this.state.index + 1 });
          if (this.state.index === this.state.total) await this.finish('completed', 'Passage finished. Use the shortcut to type the saved draft again.');
        } catch (error) {
          await this.finish('error', `Typing stopped: ${error.message} The last character may have arrived; check the editor before starting a new run.`);
        }
      });
      overhead = this.now() - start;
    }
  }

  pause(reason = 'Paused. Use the shortcut in the original editor to resume.') {
    return this.enqueue(() => ['typing', 'starting'].includes(this.state.phase) ? this.pauseInternal(reason) : undefined);
  }

  interrupt(tabId, token, reason) {
    return this.enqueue(() => this.state.tabId === tabId && this.token === token && this.state.phase === 'typing'
      ? this.pauseInternal(reason) : undefined);
  }

  async pauseInternal(message) {
    ++this.version;
    this.abort?.abort();
    this.update({ phase: 'paused', message });
    await this.cleanup();
  }

  stop(message = 'Stopped. The next run starts from the beginning of your saved draft.') {
    return this.enqueue(() => this.finish('stopped', message, true));
  }

  disconnected(tabId) {
    return this.enqueue(() => this.attached && tabId === this.state.tabId
      ? this.finish('error', 'Chrome disconnected the typing session. Check the last character before starting again.') : undefined);
  }

  async finish(phase, message, reset = false) {
    ++this.version;
    this.abort?.abort();
    this.update({ phase, message, ...(reset ? { index: 0, total: 0 } : {}) });
    await this.cleanup();
  }

  async cleanup() {
    const tabId = this.state.tabId;
    if (tabId) await this.driver.disarm(tabId, this.token).catch(() => {});
    if (this.attached) {
      this.attached = false; // Our own detach event must not cancel a later run.
      await this.driver.detach(tabId).catch(() => {});
    }
  }
}
