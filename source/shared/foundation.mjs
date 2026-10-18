// Engine-independent helpers. Pass the repository's canonical Bridge client.
const clone = value => JSON.parse(JSON.stringify(value));

export function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = Math.imul(value ^ value >>> 15, 1 | value);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export class AdPacer {
  constructor({rounds = 4, activeSeconds = 120, cooldownSeconds = 120} = {}) {
    if (!Number.isInteger(rounds) || rounds < 4 || !Number.isFinite(activeSeconds) || activeSeconds < 0 || !Number.isFinite(cooldownSeconds) || cooldownSeconds < 60) throw Error('Invalid pacing policy');
    Object.assign(this, {rounds, activeSeconds, cooldownSeconds});
    this.time = 0; this.completed = 0; this.lastAttempt = 0; this.lastRounds = 0;
  }
  tick(seconds, paused = false) {
    if (!Number.isFinite(seconds) || seconds < 0) throw Error('Invalid active time');
    if (!paused) this.time += seconds;
  }
  complete() { this.completed += 1; }
  eligible() {
    return this.completed - this.lastRounds >= this.rounds && this.time >= this.activeSeconds && this.time - this.lastAttempt >= this.cooldownSeconds;
  }
  attempt() { this.lastAttempt = this.time; this.lastRounds = this.completed; }
  rewardedAttempt() { this.lastAttempt = this.time; }
}

export async function createFoundation({client, key, initial, validate, migrate = x => x, policy, onSaveError = () => {}}) {
  if (typeof key !== 'string' || !key.trim()) throw Error('A game-specific save key is required');
  const fresh = () => ({version: 1, domain: clone(initial()), receipts: []});
  let data = fresh();
  if (!validate(data.domain)) throw Error('Invalid initial state');
  const errors = []; const report = error => { errors.push(error); if (errors.length > 64) errors.shift(); try { onSaveError(error); } catch {} };
  const loaded = await client.loadProgress(key, null); // Operational failure aborts boot; do not overwrite a cloud save.
  try {
    if (loaded !== null) {
      const candidate = migrate(clone(loaded));
      if (candidate?.version !== 1 || !validate(candidate.domain) || !Array.isArray(candidate.receipts) || candidate.receipts.length > 64 || !candidate.receipts.every(x => typeof x === 'string' && x.length <= 128)) throw Error('Corrupt or unsupported save');
      data = clone(candidate);
    }
  } catch (error) { report(error); }
  let revision = 0, savedRevision = -1, inFlight = null, scheduled = false, adBusy = false;
  const pacer = new AdPacer(policy);
  const snapshot = () => clone(data.domain);
  async function flush() {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      while (savedRevision < revision) {
        const target = revision, payload = clone(data);
        try {
          const result = await client.saveProgress(key, payload);
          if (result === false) throw Error('Save rejected by canonical client');
          savedRevision = target;
        }
        catch (error) { report(error); return false; }
      }
      return true;
    })();
    let succeeded = false;
    try { succeeded = await inFlight; return succeeded; }
    finally { inFlight = null; if (succeeded && savedRevision < revision) schedule(); }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; void flush(); });
  }
  function mutate(reducer) {
    const next = reducer(snapshot());
    if (!validate(next)) throw Error('Invalid domain mutation');
    data.domain = clone(next); revision += 1; schedule(); return snapshot();
  }
  async function interstitial(placement = 'level_completed') {
    if (adBusy || !pacer.eligible()) return false;
    adBusy = true;
    try {
      if (!await flush()) return false;
      pacer.attempt();
      return await client.showInterstitial(placement) === true;
    } catch (error) { report(error); return false; }
    finally { adBusy = false; }
  }
  async function rewarded({id, placement = 'optional_bonus', award}) {
    if (typeof id !== 'string' || !id || id.length > 128) throw Error('Reward request needs a stable unique ID');
    if (adBusy || data.receipts.includes(id)) return {state: 'unavailable', granted: false};
    adBusy = true;
    try {
      if (!await flush()) return {state: 'failed', granted: false};
      pacer.rewardedAttempt();
      const result = await client.showRewarded(placement);
      if (result?.state !== 'rewarded') return {state: result?.state ?? 'failed', granted: false};
      const next = award(snapshot());
      if (!validate(next)) throw Error('Invalid reward mutation');
      data.domain = clone(next); data.receipts = [...data.receipts, id].slice(-64); revision += 1;
      const persisted = await flush();
      return {state: 'rewarded', granted: true, persisted};
    } catch (error) { report(error); return {state: 'failed', granted: false}; }
    finally { adBusy = false; }
  }
  return {snapshot, mutate, flush, interstitial, rewarded, pacer,
    dirty: () => savedRevision < revision, errors: () => [...errors]};
}
