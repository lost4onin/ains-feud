(function () {
  const STORAGE_KEY = "ains-feud-state-v2";
  const CHANNEL_NAME = "ains-feud-live-sync";
  const ORDER = [0, 4, 1, 5, 2, 6, 3, 7];

  const DEFAULT_ROUNDS = [
    {
      id: 1,
      name: "Round 1",
      question: "Name something AI helps people do faster",
      answers: [
        { text: "Write Emails", points: 32 },
        { text: "Research", points: 24 },
        { text: "Code", points: 18 },
        { text: "Make Slides", points: 12 },
        { text: "Summarize Notes", points: 8 },
        { text: "Design Ideas", points: 6 },
        { text: "Translate", points: 4 },
        { text: "Plan Events", points: 2 }
      ]
    },
    {
      id: 2,
      name: "Round 2",
      question: "Name a job where AI can be a useful assistant",
      answers: [
        { text: "Teacher", points: 28 },
        { text: "Doctor", points: 22 },
        { text: "Programmer", points: 18 },
        { text: "Designer", points: 12 },
        { text: "Marketer", points: 8 },
        { text: "Engineer", points: 6 },
        { text: "Lawyer", points: 4 },
        { text: "Student", points: 2 }
      ]
    },
    {
      id: 3,
      name: "Round 3",
      question: "Name something people ask a chatbot to do",
      answers: [
        { text: "Explain A Topic", points: 30 },
        { text: "Write A Message", points: 20 },
        { text: "Fix Code", points: 16 },
        { text: "Make A Plan", points: 12 },
        { text: "Translate Text", points: 8 },
        { text: "Create Ideas", points: 6 },
        { text: "Summarize A File", points: 5 },
        { text: "Solve Homework", points: 3 }
      ]
    },
    {
      id: 4,
      name: "Round 4",
      question: "Name a concern people have about artificial intelligence",
      answers: [
        { text: "Job Loss", points: 27 },
        { text: "Privacy", points: 21 },
        { text: "Fake News", points: 16 },
        { text: "Bias", points: 12 },
        { text: "Security", points: 9 },
        { text: "Cheating", points: 7 },
        { text: "Cost", points: 5 },
        { text: "Too Much Trust", points: 3 }
      ]
    },
    {
      id: 5,
      name: "Round 5",
      question: "Name a place you expect to see AI in the future",
      answers: [
        { text: "Hospitals", points: 26 },
        { text: "Schools", points: 22 },
        { text: "Cars", points: 18 },
        { text: "Homes", points: 12 },
        { text: "Banks", points: 8 },
        { text: "Airports", points: 6 },
        { text: "Factories", points: 5 },
        { text: "Government", points: 3 }
      ]
    }
  ];
  const FIRST_ROUND = DEFAULT_ROUNDS[0];

  const DEFAULT_STATE = {
    activeRoundId: null,
    activeRoundName: FIRST_ROUND.name,
    question: FIRST_ROUND.question,
    rounds: DEFAULT_ROUNDS,
    strikes: 0,
    strikePulse: 0,
    multiplier: 1,
    teamScores: [0, 0],
    roundScore: 0,
    roundOwner: null,
    roundClosed: false,
    answers: FIRST_ROUND.answers.map((answer) => Object.assign({}, answer, {
      revealed: false,
      scoredBy: null,
      scoredPoints: 0
    }))
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
      const scoredBy = answer.scoredBy;
      const normalizedScoredBy = scoredBy === 0 || scoredBy === 1
        ? scoredBy
        : scoredBy === "bank" || scoredBy === 99
          ? "bank"
          : null;

      return {
        text: typeof answer.text === "string" ? answer.text : fallback.text,
        points: Number.isFinite(Number(answer.points)) ? Number(answer.points) : fallback.points,
        revealed: Boolean(answer.revealed),
        scoredBy: normalizedScoredBy,
        scoredPoints: Number.isFinite(Number(answer.scoredPoints)) ? Number(answer.scoredPoints) : 0
      };
    });

    safe.question = typeof safe.question === "string" ? safe.question : DEFAULT_STATE.question;
    safe.activeRoundId = Number.isInteger(Number(safe.activeRoundId)) && Number(safe.activeRoundId) > 0 ? Number(safe.activeRoundId) : null;
    safe.activeRoundName = typeof safe.activeRoundName === "string" ? safe.activeRoundName : DEFAULT_STATE.activeRoundName;
    safe.strikes = Math.max(0, Math.min(4, Number(safe.strikes) || 0));
    safe.multiplier = Math.max(1, Math.min(3, Number(safe.multiplier) || 1));
    safe.strikePulse = Number(safe.strikePulse) || 0;
    safe.teamScores = Array.isArray(safe.teamScores) ? safe.teamScores : DEFAULT_STATE.teamScores;
    safe.teamScores = [
      Math.max(0, Number(safe.teamScores[0]) || 0),
      Math.max(0, Number(safe.teamScores[1]) || 0)
    ];
    safe.roundScore = Math.max(0, Number(safe.roundScore) || 0);
    safe.roundOwner = safe.roundOwner === 0 || safe.roundOwner === 1 ? safe.roundOwner : null;
    safe.roundClosed = Boolean(safe.roundClosed);

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
