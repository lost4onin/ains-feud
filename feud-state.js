(function () {
  const STORAGE_KEY = "ains-feud-state-v2";
  const CHANNEL_NAME = "ains-feud-live-sync";
  const ORDER = [0, 4, 1, 5, 2, 6, 3, 7];

  const DEFAULT_STATE = {
    question: "Name something AI helps people do faster",
    strikes: 0,
    strikePulse: 0,
    answers: [
      { text: "Write Emails", points: 32, revealed: false },
      { text: "Research", points: 24, revealed: false },
      { text: "Code", points: 18, revealed: false },
      { text: "Make Slides", points: 12, revealed: false },
      { text: "Summarize Notes", points: 8, revealed: false },
      { text: "Design Ideas", points: 6, revealed: false },
      { text: "Translate", points: 4, revealed: false },
      { text: "Plan Events", points: 2, revealed: false }
    ]
  };

  const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;
  const subscribers = new Set();
  let state = normalize(loadStoredState());

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadStoredState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFAULT_STATE;
    } catch (error) {
      return DEFAULT_STATE;
    }
  }

  function normalize(nextState) {
    const safe = Object.assign({}, DEFAULT_STATE, nextState || {});
    const answers = Array.isArray(safe.answers) ? safe.answers : [];

    safe.answers = DEFAULT_STATE.answers.map((fallback, index) => {
      const answer = answers[index] || {};
      return {
        text: typeof answer.text === "string" ? answer.text : fallback.text,
        points: Number.isFinite(Number(answer.points)) ? Number(answer.points) : fallback.points,
        revealed: Boolean(answer.revealed)
      };
    });

    safe.question = typeof safe.question === "string" ? safe.question : DEFAULT_STATE.question;
    safe.strikes = Math.max(0, Math.min(3, Number(safe.strikes) || 0));
    safe.strikePulse = Number(safe.strikePulse) || 0;

    return safe;
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (channel) {
      channel.postMessage(clone(state));
    }
  }

  function notify() {
    const snapshot = clone(state);
    subscribers.forEach((subscriber) => subscriber(snapshot));
  }

  function setState(updater) {
    const draft = clone(state);
    state = normalize(typeof updater === "function" ? updater(draft) : updater);
    persist();
    notify();
  }

  function subscribe(callback) {
    subscribers.add(callback);
    callback(clone(state));

    return () => {
      subscribers.delete(callback);
    };
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) {
      return;
    }

    try {
      state = normalize(JSON.parse(event.newValue));
      notify();
    } catch (error) {
      state = normalize(DEFAULT_STATE);
      notify();
    }
  });

  if (channel) {
    channel.addEventListener("message", (event) => {
      state = normalize(event.data);
      notify();
    });
  }

  window.AINSFeud = {
    answerOrder: ORDER,
    defaults: clone(DEFAULT_STATE),
    getState: () => clone(state),
    setState,
    subscribe
  };
}());
