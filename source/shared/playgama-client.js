const MEMORY_STORE = new Map();
const DEFAULT_BRIDGE_WAIT_TIMEOUT_MS = 5000;
const DEFAULT_BRIDGE_POLL_INTERVAL_MS = 50;
const OFFICIAL_BRIDGE_CDN_RE = /https:\/\/bridge\.playgama\.com\/v2\/stable\/playgama-bridge\.js/i;

function createMemoryBridge() {
  return {
    isWorksBienFallback: true,
    initialize: async () => true,
    platform: {
      language: "en",
      isAudioEnabled: true,
      sendMessage: async () => false
    },
    storage: {
      get: async (key) => MEMORY_STORE.get(key) ?? null,
      set: async (key, value) => {
        MEMORY_STORE.set(key, value);
        return true;
      },
      delete: async (key) => {
        MEMORY_STORE.delete(key);
        return true;
      }
    },
    advertisement: {
      showInterstitial: async () => false,
      showRewarded: async () => ({ state: "unavailable" })
    },
    analytics: {
      send: async () => false
    }
  };
}

function hasOfficialBridgeScript() {
  const scripts = globalThis.document?.scripts;
  if (!scripts) return false;

  try {
    return Array.from(scripts).some((script) => OFFICIAL_BRIDGE_CDN_RE.test(script.src || ""));
  } catch {
    return false;
  }
}

async function waitForGlobalBridge(options = {}) {
  if (globalThis.bridge) return globalThis.bridge;
  if (!hasOfficialBridgeScript()) return null;

  const timeoutMs = options.bridgeWaitTimeoutMs ?? DEFAULT_BRIDGE_WAIT_TIMEOUT_MS;
  const pollIntervalMs = options.bridgePollIntervalMs ?? DEFAULT_BRIDGE_POLL_INTERVAL_MS;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    if (globalThis.bridge) return globalThis.bridge;
  }

  console.warn("Playgama Bridge script was present, but window.bridge did not become available before timeout");
  return null;
}

async function getRawBridge(explicitBridge, options = {}) {
  const result = explicitBridge || (await waitForGlobalBridge(options));
  if (result) return result;
  if (options.allowMemoryFallback === true) return createMemoryBridge();
  throw new Error("Bridge unavailable: show a retry screen; memory fallback is preview-only");
}

async function safeCall(fn, args = [], fallback = undefined) {
  if (typeof fn !== "function") return fallback;

  try {
    return await fn(...args);
  } catch (error) {
    console.warn("Playgama Bridge call failed", error);
    return fallback;
  }
}

async function initializeBridge(bridge) {
  if (typeof bridge?.initialize !== "function") {
    throw new Error("Playgama Bridge initialize() is unavailable");
  }
  try {
    const result = await bridge.initialize();
    if (result === false) throw new Error("Playgama Bridge initialization failed");
    return result;
  } catch (error) {
    console.warn("Playgama Bridge initialization failed", error);
    // Do not start gameplay or pretend to save through an uninitialized SDK.
    throw error;
  }
}

async function sendGameReady(bridge) {
  if (typeof bridge?.platform?.sendMessage !== "function") return false;
  try {
    // Keep this as the official Plain JS call shape Playgama validates.
    return await bridge.platform.sendMessage("game_ready");
  } catch (error) {
    console.warn("Playgama game_ready message failed", error);
    return false;
  }
}

async function tryVariants(fn, variants, fallback = undefined) {
  if (typeof fn !== "function") return fallback;

  for (const args of variants) {
    try {
      return await fn(...args);
    } catch {
      // Try the next SDK signature shape.
    }
  }

  return fallback;
}

function parseStoredValue(value, key, fallback) {
  // The Bridge answers storage.get([key]) with an array of values (one per key).
  if (Array.isArray(value) && value.length === 1) value = value[0];
  if (value === undefined || value === null || value === "") return fallback;

  let candidate = value;
  if (typeof value === "object" && key in value) {
    candidate = value[key];
  }

  if (typeof candidate !== "string") return candidate;

  try {
    return JSON.parse(candidate);
  } catch {
    return candidate;
  }
}

function normalizeLanguage(rawLanguage) {
  if (!rawLanguage || typeof rawLanguage !== "string") return "en";
  return rawLanguage.toLowerCase().split(/[-_]/)[0] || "en";
}

function subscribe(target, names, handler) {
  if (!target) return () => {};

  const unsubscribers = [];

  for (const name of names) {
    if (typeof target.on === "function") {
      try {
        const off = target.on(name, handler);
        if (typeof off === "function") unsubscribers.push(off);
        else if (typeof target.off === "function") unsubscribers.push(() => target.off(name, handler));
      } catch {
        // Continue because Bridge event names can differ by adapter version.
      }
    } else if (typeof target.addEventListener === "function") {
      try {
        target.addEventListener(name, handler);
        unsubscribers.push(() => target.removeEventListener?.(name, handler));
      } catch {
        // Continue because unsupported local mocks may not expose DOM-style events.
      }
    }
  }

  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}

function readPlatformAudioState(platform) {
  if (typeof platform?.isAudioEnabled === "boolean") return platform.isAudioEnabled;
  if (typeof platform?.audioEnabled === "boolean") return platform.audioEnabled;
  return true;
}

function readAudioEventState(event, platform) {
  if (typeof event === "boolean") return event;
  if (typeof event?.isAudioEnabled === "boolean") return event.isAudioEnabled;
  if (typeof event?.audioEnabled === "boolean") return event.audioEnabled;
  if (typeof event?.enabled === "boolean") return event.enabled;
  return readPlatformAudioState(platform);
}

function readPauseEventState(event, platform) {
  if (typeof event === "boolean") return event;
  if (typeof event?.isPaused === "boolean") return event.isPaused;
  if (typeof event?.paused === "boolean") return event.paused;
  if (typeof event?.value === "boolean") return event.value;
  if (typeof platform?.isPaused === "boolean") return platform.isPaused;
  if (typeof platform?.paused === "boolean") return platform.paused;
  return false;
}

// Playgama Bridge ads are event driven: show*() returns nothing and the outcome
// arrives later on `interstitial_state_changed` / `rewarded_state_changed`
// (states: loading, opened, closed, failed, plus rewarded for rewarded ads).
// When the delay rules block an interstitial the SDK emits `failed` without ever
// opening an ad. This runner turns one show call into a single promise.
const DEFAULT_AD_TIMINGS = Object.freeze({
  noResponseMs: 10000,
  maxOpenMs: 5 * 60 * 1000,
  rewardCloseGraceMs: 3000
});

function createAdRunner(advertisement, eventName, timings) {
  let pending = null;

  const handler = (state) => {
    if (pending) pending(typeof state === "string" ? state : state?.state);
  };
  const eventDriven = typeof advertisement?.on === "function";
  if (eventDriven) subscribe(advertisement, [eventName], handler);

  return {
    eventDriven,
    run(start) {
      if (pending) return Promise.resolve({ state: "failed", opened: false });

      return new Promise((resolve) => {
        let opened = false;
        let rewarded = false;
        let timer = 0;

        const finish = (state) => {
          clearTimeout(timer);
          pending = null;
          resolve({ state, opened, rewarded });
        };
        const arm = (ms, state) => {
          clearTimeout(timer);
          timer = setTimeout(() => finish(state), ms);
        };

        pending = (state) => {
          if (state === "opened") {
            opened = true;
            arm(timings.maxOpenMs, "failed");
          } else if (state === "loading") {
            arm(timings.maxOpenMs, "failed");
          } else if (state === "rewarded") {
            rewarded = true;
            arm(timings.rewardCloseGraceMs, "rewarded");
          } else if (state === "closed") {
            finish(rewarded ? "rewarded" : "closed");
          } else if (state === "failed") {
            finish("failed");
          }
        };

        arm(timings.noResponseMs, "failed");
        try {
          start();
        } catch {
          finish("failed");
        }
      });
    }
  };
}

export async function bootPlaygamaGame(options = {}) {
  const rawBridge = await getRawBridge(options.bridge, options);
  // The official SDK module getters are unavailable until initialize resolves.
  // Reading them earlier permanently caches empty modules, silently losing saves.
  await initializeBridge(rawBridge);

  const platform = rawBridge.platform || {};
  const storage = rawBridge.storage || {};
  const advertisement = rawBridge.advertisement || {};
  const analytics = rawBridge.analytics || {};
  const hostOnlyLifecycle = platform.id === "youtube";

  const adTimings = { ...DEFAULT_AD_TIMINGS, ...(options.adTimings || {}) };
  const interstitialRunner = createAdRunner(advertisement, "interstitial_state_changed", adTimings);
  const rewardedRunner = createAdRunner(advertisement, "rewarded_state_changed", adTimings);

  // Retain state independently of a game's asynchronous save/loading lifecycle.
  // Clearing one reason can never clear another owner's pause.
  const pauseReasons = new Set();
  if (readPauseEventState(undefined, platform)) pauseReasons.add("platform");
  if (!hostOnlyLifecycle && globalThis.document?.hidden) pauseReasons.add("visibility");
  let platformAudioEnabled = readPlatformAudioState(platform);
  const stateListeners = new Set();
  const bindings = new Set();
  let previousState = null;
  let adBusy = false;
  const snapshot = () => Object.freeze({
    paused: pauseReasons.size > 0,
    audioEnabled: platformAudioEnabled && pauseReasons.size === 0
  });
  const notifyState = () => {
    const state = snapshot();
    if (previousState?.paused === state.paused && previousState?.audioEnabled === state.audioEnabled) return;
    const previous = previousState;
    previousState = state;
    for (const listener of stateListeners) listener(state);
    if (previous?.paused !== state.paused) {
      if (state.paused) options.onPause?.();
      else options.onResume?.();
    }
    if (previous?.audioEnabled !== state.audioEnabled) {
      options.onAudioChange?.(state.audioEnabled);
      if (state.audioEnabled) options.onUnmute?.();
      else options.onMute?.();
    }
  };
  const setPauseReason = (reason, paused) => {
    if (paused) pauseReasons.add(reason);
    else pauseReasons.delete(reason);
    notifyState();
  };

  const client = {
    get isPaused() { return snapshot().paused; },
    get isAudioEnabled() { return snapshot().audioEnabled; },
    setPauseReason,
    onStateChange(listener) {
      stateListeners.add(listener);
      listener(snapshot()); // Replay initial state and signals received during load.
      return () => stateListeners.delete(listener);
    },
    bindGame({ root, setPaused, setAudioEnabled }) {
      if (!root?.addEventListener || typeof setPaused !== "function" || typeof setAudioEnabled !== "function") {
        throw new Error("bindGame requires a game root and pause/audio setters");
      }
      const originalInert = Boolean(root.inert);
      const blockInput = (event) => {
        if (event.key === "Escape") return; // Host Esc action must never be prevented.
        if (!client.isPaused) return;
        // User-pause controls live outside the inert root; host/ad pauses still block them.
        if (pauseReasons.size === 1 && pauseReasons.has("user") && event.target?.closest?.("[data-resume-control]")) return;
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
      };
      // Capture also blocks synthetic clicks and document-level keyboard controls.
      const inputEvents = ["click", "dblclick", "pointerdown", "pointerup", "pointermove", "mousedown", "mouseup", "touchstart", "touchend", "keydown", "keyup", "input", "change", "wheel", "contextmenu"];
      const target = root.ownerDocument || globalThis.document || root;
      for (const type of inputEvents) target.addEventListener(type, blockInput, { capture: true, passive: false });
      const unsubscribe = client.onStateChange(({ paused, audioEnabled }) => {
        root.inert = originalInert || paused;
        root.setAttribute?.("data-playgama-paused", String(paused));
        setAudioEnabled(audioEnabled);
        setPaused(paused);
      });
      const dispose = () => {
        unsubscribe();
        for (const type of inputEvents) target.removeEventListener?.(type, blockInput, { capture: true });
        root.inert = originalInert;
        root.removeAttribute?.("data-playgama-paused");
        bindings.delete(dispose);
      };
      bindings.add(dispose);
      return dispose;
    },
    bridge: rawBridge,
    isFallback: Boolean(rawBridge.isWorksBienFallback),
    platformId: platform.id || "unknown",
    language: normalizeLanguage(platform.language),

    async gameReady() {
      return sendGameReady(rawBridge);
    },

    async loadProgress(key, fallback = null) {
      // A rejected official call is an operational failure, not a reason to
      // retry undocumented signatures. Only our own memory adapter is scalar.
      const args = rawBridge.isWorksBienFallback ? [key] : [[key]];
      if (typeof storage.get !== "function") throw new Error("Bridge storage.get unavailable");
      const value = await storage.get(...args); // A rejected load must not masquerade as an empty save.
      if (!rawBridge.isWorksBienFallback && (!Array.isArray(value) || value.length !== 1)) throw new Error("Invalid Bridge storage.get result; refusing to overwrite progress");
      return parseStoredValue(value, key, fallback);
    },

    async saveProgress(key, value) {
      const serialized = JSON.stringify(value);
      if (new TextEncoder().encode(serialized).byteLength >= 3 * 1024 * 1024) throw new Error("Save must be smaller than 3 MiB; keep progress compact");
      const args = rawBridge.isWorksBienFallback ? [key, serialized] : [[key], [serialized]];
      return safeCall(storage.set?.bind(storage), args, false);
    },

    async deleteProgress(key) {
      const args = rawBridge.isWorksBienFallback ? [key] : [[key]];
      return safeCall(storage.delete?.bind(storage), args, false);
    },

    // Resolves true only when an ad actually opened and finished; false when it
    // was blocked by the delay rules, failed, or ads are unavailable.
    async showInterstitial(placement = "game_over") {
      if (adBusy) return false;
      adBusy = true;
      setPauseReason("advertisement", true);
      try {
      if (!interstitialRunner.eventDriven) {
        const result = await tryVariants(
          advertisement.showInterstitial?.bind(advertisement),
          [[placement], [{ placement }], []],
          false
        );
        return result === undefined ? false : Boolean(result);
      }
      const outcome = await interstitialRunner.run(() => advertisement.showInterstitial(placement));
      return outcome.opened && outcome.state !== "failed";
      } finally {
        adBusy = false;
        setPauseReason("advertisement", false);
      }
    },

    // Resolves { state } where state is "rewarded" only after the SDK reports the
    // reward; otherwise "closed", "failed" or "unavailable". Grant rewards on "rewarded" only.
    async showRewarded(placement = "optional_bonus") {
      if (typeof advertisement.showRewarded !== "function") return { state: "unavailable" };
      if (adBusy) return { state: "failed" };
      adBusy = true;
      setPauseReason("advertisement", true);
      try {
      if (!rewardedRunner.eventDriven) {
        return tryVariants(
          advertisement.showRewarded.bind(advertisement),
          [[placement], [{ placement }], []],
          { state: "unavailable" }
        );
      }
      const outcome = await rewardedRunner.run(() => advertisement.showRewarded(placement));
      return { state: outcome.state };
      } finally {
        adBusy = false;
        setPauseReason("advertisement", false);
      }
    },

    async sendAnalytics(eventName, payload = {}) {
      if (hostOnlyLifecycle) throw new Error("Analytics is disabled for the YouTube profile");
      return tryVariants(
        analytics.send?.bind(analytics) || analytics.track?.bind(analytics),
        [[eventName, payload], [{ eventName, payload }], [{ name: eventName, params: payload }]],
        false
      );
    }
  };

  const pauseHandler = () => setPauseReason("platform", true);
  const resumeHandler = () => setPauseReason("platform", false);
  const pauseStateHandler = (event) => setPauseReason("platform", readPauseEventState(event, platform));
  const audioHandler = (event) => {
    platformAudioEnabled = readAudioEventState(event, platform);
    notifyState();
  };
  const unsubscribePause = subscribe(platform, ["pause", "paused"], pauseHandler);
  const unsubscribeResume = subscribe(platform, ["resume", "resumed", "play"], resumeHandler);
  const unsubscribePauseState = subscribe(platform, ["pause_state_changed"], pauseStateHandler);
  const unsubscribeAudio = subscribe(platform, ["audio", "audio_state_changed", "is_audio_enabled_changed"], audioHandler);
  const visibilityHandler = () => setPauseReason("visibility", Boolean(globalThis.document?.hidden));
  const blurHandler = () => setPauseReason("blur", true);
  const focusHandler = () => setPauseReason("blur", false);

  if (!hostOnlyLifecycle) {
    globalThis.document?.addEventListener?.("visibilitychange", visibilityHandler);
    globalThis.addEventListener?.("blur", blurHandler);
    globalThis.addEventListener?.("focus", focusHandler);
  }
  notifyState();

  client.dispose = () => {
    for (const dispose of [...bindings]) dispose();
    stateListeners.clear();
    unsubscribePause();
    unsubscribeResume();
    unsubscribePauseState();
    unsubscribeAudio();
    globalThis.document?.removeEventListener?.("visibilitychange", visibilityHandler);
    globalThis.removeEventListener?.("blur", blurHandler);
    globalThis.removeEventListener?.("focus", focusHandler);
  };

  return client;
}

