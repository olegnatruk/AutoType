import test from 'node:test';
import assert from 'node:assert/strict';
import { segmentText, createSchedule, estimateDuration, validateDraft, TypingSession, CommandController, wait } from '../extension/core.js';

test('Unicode graphemes and whitespace survive segmentation', () => {
  const text = 'Hi 👩🏽‍💻, cafe\u0301!\t\n\nDone.';
  const segments = segmentText(text);
  assert.equal(segments.join(''), text);
  assert.ok(segments.includes('👩🏽‍💻'));
  assert.ok(segments.includes('e\u0301'));
  assert.deepEqual(segmentText('a\r\nb\rc'), ['a', '\n', 'b', '\n', 'c']);
});
test('natural timing totals 75 WPM with punctuation pauses', () => {
  const text = segmentText('A passage, with pauses.\nAnd another line!');
  const schedule = createSchedule(text, () => 0.5);
  assert.ok(Math.abs(schedule.reduce((sum, delay) => sum + delay, 0) - text.length * 160) < 0.001);
  assert.ok(schedule[text.indexOf('.')] > schedule[0]);
  assert.equal(estimateDuration('abcde'), 800);
  assert.deepEqual(createSchedule([]), []);
});
test('random pacing stays finite and positive even for short passages', () => {
  for (const text of ['.', '\n\n', 'hello', 'a'.repeat(1000)]) {
    for (const random of [() => 0, () => 1]) {
      const characters = segmentText(text);
      const schedule = createSchedule(characters, random);
      assert.ok(schedule.every(ms => ms > 0 && Number.isFinite(ms)));
    }
  }
});
test('draft validation never trims whitespace and caps size', () => {
  assert.equal(validateDraft(' \n\t'), ' \n\t');
  assert.throws(() => validateDraft(null), /plain text/u);
  assert.throws(() => validateDraft('a'.repeat(200001)), /200,000/u);
});
test('wait is immediately abortable', async () => {
  const controller = new AbortController();
  const waiting = wait(100000, controller.signal);
  controller.abort();
  await waiting;
  await wait(100000, controller.signal);
});

function fixture(draft = 'abc') {
  const delays = [];
  const sent = [];
  const events = [];
  const flags = { active: true, focused: true, fail: false, attaches: 0, detaches: 0 };
  const driver = {
    capture: async () => ({ kind: 'textarea' }),
    attach: async () => { flags.attaches++; },
    arm: async () => { if (!flags.focused) throw new Error('Focus changed'); },
    check: async () => flags.focused,
    isActive: async () => flags.active,
    send: async (_, character) => { if (flags.fail) throw new Error('Disconnected'); sent.push(character); },
    disarm: async () => {},
    detach: async () => { flags.detaches++; }
  };
  const session = new TypingSession({ driver, getDraft: async () => draft, publish: state => events.push(state),
    sleep: (_, signal) => new Promise(resolve => {
      const finish = () => { signal.removeEventListener('abort', finish); resolve(); };
      delays.push(finish);
      signal.addEventListener('abort', finish, { once: true });
    }), now: () => 0, random: () => 0.5 });
  const tick = async () => { delays.shift()?.(); await new Promise(resolve => setImmediate(resolve)); await session.queue; };
  return { session, tick, sent, flags, events, driver, delays };
}
const tab = { id: 7, url: 'https://example.com' };

test('start snapshots draft and completes exactly once', async () => {
  const f = fixture('ab👩🏽‍💻\n');
  await f.session.toggle(tab);
  f.session.getDraft = async () => 'replacement';
  for (let i = 0; i < 4; i++) await f.tick();
  assert.equal(f.sent.join(''), 'ab👩🏽‍💻\n');
  assert.equal(f.session.state.phase, 'completed');
  assert.equal(f.flags.attaches, 1);
  assert.equal(f.flags.detaches, 1);
});
test('pause/resume advances once and refuses a different tab', async () => {
  const f = fixture();
  await f.session.toggle(tab);
  await f.tick();
  await f.session.toggle(tab);
  await f.tick(); // Drain canceled timer.
  assert.deepEqual(f.sent, ['a']);
  await f.session.toggle({ ...tab, id: 8 });
  assert.equal(f.session.state.phase, 'paused');
  await f.session.toggle(tab);
  await f.tick();
  await f.tick();
  assert.equal(f.sent.join(''), 'abc');
  assert.equal(f.flags.detaches, 2);
});
test('queued duplicate starts toggle to paused without a second run', async () => {
  const f = fixture();
  await Promise.all([f.session.toggle(tab), f.session.toggle(tab)]);
  assert.equal(f.flags.attaches, 1);
  assert.equal(f.session.state.phase, 'paused');
  await f.tick();
  assert.equal(f.sent.length, 0);
});
test('stop cancels timer and resets progress', async () => {
  const f = fixture();
  await f.session.toggle(tab);
  await f.tick();
  await f.session.stop();
  await f.tick();
  assert.equal(f.sent.join(''), 'a');
  assert.equal(f.session.state.index, 0);
  assert.equal(f.session.state.total, 0);
});
test('focus loss pauses before dispatching another character', async () => {
  const f = fixture();
  await f.session.toggle(tab);
  f.flags.focused = false;
  await f.tick();
  assert.equal(f.sent.length, 0);
  assert.equal(f.session.state.phase, 'paused');
  assert.equal(f.flags.detaches, 1);
});
test('stale page messages cannot pause a new session', async () => {
  const f = fixture();
  await f.session.toggle(tab);
  await f.session.interrupt(tab.id, 'old-token', 'Stale');
  await f.session.interrupt(99, f.session.token, 'Wrong tab');
  assert.equal(f.session.state.phase, 'typing');
  await f.session.stop();
});
test('dispatch failure and external disconnect stop without retries', async () => {
  const f = fixture();
  await f.session.toggle(tab);
  await f.tick();
  f.flags.fail = true;
  await f.tick();
  await f.tick();
  assert.equal(f.sent.join(''), 'a');
  assert.equal(f.session.state.phase, 'error');
  assert.equal(f.flags.detaches, 1);
  const g = fixture();
  await g.session.toggle(tab);
  await g.session.disconnected(tab.id);
  await g.tick();
  assert.equal(g.sent.length, 0);
  assert.equal(g.session.state.phase, 'error');
});
test('stop waits for an in-flight acknowledgment without duplicating it', async () => {
  const f = fixture();
  let release;
  f.driver.send = async (_, character) => {
    await new Promise(resolve => { release = resolve; });
    f.sent.push(character);
  };
  await f.session.toggle(tab);
  f.delays.shift()();
  await new Promise(resolve => setImmediate(resolve));
  const stopped = f.session.stop();
  release();
  await stopped;
  await f.tick();
  assert.equal(f.sent.join(''), 'a');
  assert.equal(f.session.state.phase, 'stopped');
});
test('paused checkpoint survives worker suspension, active run never auto-resumes', async () => {
  const f = fixture();
  await f.session.toggle(tab);
  const active = f.session.checkpoint();
  await f.tick();
  await f.session.pause();
  const g = fixture();
  g.session.restore(f.session.checkpoint());
  await g.session.toggle(tab);
  await g.tick();
  await g.tick();
  assert.equal(g.sent.join(''), 'bc');
  const h = fixture();
  h.session.restore(active);
  assert.equal(h.session.state.phase, 'error');
  assert.equal(h.flags.attaches, 0);
});
test('uneditable targets, restricted URLs, and empty drafts fail before attaching', async () => {
  const f = fixture('');
  await f.session.toggle(tab);
  assert.equal(f.session.state.phase, 'error');
  assert.equal(f.flags.attaches, 0);
  const g = fixture();
  await g.session.toggle({ id: 7, url: 'chrome://extensions' });
  assert.equal(g.flags.attaches, 0);
  const h = fixture();
  h.driver.capture = async () => { throw new Error('Password fields are unsupported.'); };
  await h.session.toggle(tab);
  assert.equal(h.flags.attaches, 0);
  assert.match(h.session.state.message, /Password/u);
});

function commandFixture() {
  const calls = [];
  const timers = new Map();
  let timerId = 0;
  const controller = new CommandController({
    session: { toggle: async target => calls.push(['toggle', target.id]), stop: async () => calls.push(['stop']) },
    ready: Promise.resolve(), saved: async () => {}, currentTab: async () => ({ ...tab, id: 99 }), isActive: async () => true,
    schedule: callback => { timers.set(++timerId, callback); return timerId; },
    unschedule: id => timers.delete(id)
  });
  const flush = async () => { for (const [id, callback] of timers) { timers.delete(id); await callback(); } };
  return { controller, calls, flush };
}
test('Stop during shortcut delay cancels the pending start', async () => {
  const f = commandFixture();
  f.controller.handle('toggle-typing', tab);
  await f.controller.handle('stop-typing', tab);
  await f.flush();
  assert.deepEqual(f.calls, [['stop']]);
});
test('command repeat coalesces and uses the invoking tab, not a later tab', async () => {
  const f = commandFixture();
  f.controller.handle('toggle-typing', tab);
  f.controller.handle('toggle-typing', tab);
  await f.flush();
  assert.deepEqual(f.calls, [['toggle', 7]]);
});
test('focus/navigation cancellation also cancels an already fired startup waiting on storage', async () => {
  const f = commandFixture();
  let release;
  f.controller.saved = () => new Promise(resolve => { release = resolve; });
  f.controller.handle('toggle-typing', tab);
  const fired = f.flush();
  await new Promise(resolve => setImmediate(resolve));
  f.controller.cancel();
  release();
  await fired;
  assert.equal(f.calls.length, 0);
});
