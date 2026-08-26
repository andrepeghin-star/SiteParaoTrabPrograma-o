(function () {
  const tema = document.getElementById("tema");
  const tamanho = document.getElementById("tamanho");
  const vozSelect = document.getElementById("voz");
  const btnFala = document.getElementById("btn-fala");
  const btnGuia = document.getElementById("btn-guia");
  const btnOuvir = document.getElementById("btn-ouvir");
  const btnAjudaVoz = document.getElementById("btn-ajuda-voz");
  const assistenteStatus = document.getElementById("assistente-status");
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const views = Array.from(document.querySelectorAll(".view"));
  const profileButtons = Array.from(document.querySelectorAll(".profile-btn"));
  const perfilStatus = document.getElementById("perfil-status");
  const questionButtons = Array.from(document.querySelectorAll("[data-question]"));
  const assistantAnswer = document.getElementById("assistente-resposta");

  const estado = {
    numero: {
      current: null,
      hits: 0,
      misses: 0,
    },
    memoria: {
      sequence: [],
      round: 0,
      best: 0,
      input: [],
      accepting: false,
    },
    rota: {
      current: null,
      hits: 0,
      misses: 0,
    },
    voices: [],
    speechQueue: [],
    speaking: false,
    recognition: null,
  };

  const $ = (id) => document.getElementById(id);
  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const gameViews = ["numero", "memoria", "orientacao"];
  const supportedThemes = ["claro", "escuro", "alto", "protanopia"];

  const scoreVoice = (voice) => {
    const name = voice.name.toLowerCase();
    const lang = voice.lang.toLowerCase();
    let score = 0;

    if (lang === "pt-br") score += 100;
    if (lang.startsWith("pt")) score += 50;
    if (/brasil|brazil|portugu[eê]s do brasil/.test(name)) score += 30;
    if (/google|natural|online|neural|maria|francisca|antonio|luciana|helena/.test(name)) score += 20;
    if (/compact|eloquence|legacy/.test(name)) score -= 20;

    return score;
  };

  const voiceLabel = (voice) => {
    const recommended = scoreVoice(voice) >= 120 ? " - recomendada" : "";
    return `${voice.name} (${voice.lang})${recommended}`;
  };

  const refreshVoices = () => {
    if (!("speechSynthesis" in window)) {
      vozSelect.innerHTML = '<option value="">Voz não suportada neste navegador</option>';
      btnFala.disabled = true;
      return;
    }

    const allVoices = speechSynthesis.getVoices();
    const ptBrVoices = allVoices.filter((voice) =>
      /pt[-_]BR|pt[-_]|portuguese/i.test(voice.lang) || /brasil|brazil|portugu[eê]s/i.test(voice.name)
    );
    estado.voices = (ptBrVoices.length ? ptBrVoices : allVoices).sort((a, b) => scoreVoice(b) - scoreVoice(a));
    vozSelect.innerHTML = estado.voices.length
      ? estado.voices.map((voice) => `<option value="${voice.name}">${voiceLabel(voice)}</option>`).join("")
      : '<option value="">Nenhuma voz encontrada</option>';

    if (estado.voices.length && !vozSelect.value) {
      vozSelect.value = estado.voices[0].name;
    }
  };

  const processSpeechQueue = () => {
    if (estado.speaking || !estado.speechQueue.length || !("speechSynthesis" in window)) return;

    const item = estado.speechQueue.shift();
    const utterance = new SpeechSynthesisUtterance(item.text);
    const chosenVoice = estado.voices.find((voice) => voice.name === vozSelect.value);

    utterance.lang = "pt-BR";
    utterance.rate = 0.82;
    utterance.pitch = 0.98;
    utterance.volume = 1;
    if (chosenVoice) utterance.voice = chosenVoice;

    estado.speaking = true;
    utterance.onend = () => {
      estado.speaking = false;
      item.resolve();
      setTimeout(processSpeechQueue, 120);
    };
    utterance.onerror = () => {
      estado.speaking = false;
      item.resolve();
      setTimeout(processSpeechQueue, 120);
    };

    speechSynthesis.speak(utterance);
  };

  const speak = (text, options = {}) => {
    if (!("speechSynthesis" in window)) return Promise.resolve();

    if (options.interrupt) {
      estado.speechQueue = [];
      estado.speaking = false;
      speechSynthesis.cancel();
    }

    return new Promise((resolve) => {
      estado.speechQueue.push({ text, resolve });
      processSpeechQueue();
    });
  };

  const setStatus = (id, text, kind) => {
    const el = $(id);
    el.textContent = text;
    el.classList.remove("is-correct", "is-wrong");
    if (kind === "correct") el.classList.add("is-correct");
    if (kind === "wrong") el.classList.add("is-wrong");
  };

  const savePreferences = () => {
    try {
      localStorage.setItem("incluiPlayPreferences", JSON.stringify({
        theme: tema.value,
        fontSize: tamanho.value,
        profile: document.body.dataset.profile || "",
        motion: document.body.dataset.motion || "",
      }));
    } catch {
      // O site segue funcionando quando o navegador bloqueia armazenamento local.
    }
  };

  const updateTheme = () => {
    document.body.dataset.theme = tema.value;
    savePreferences();
  };

  const updateFontSize = () => {
    document.documentElement.style.fontSize = `${tamanho.value}px`;
    savePreferences();
  };

  const setProfileButtonState = (profile) => {
    profileButtons.forEach((button) => {
      const active = button.dataset.profile === profile;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("is-active", active);
    });
  };

  const applyProfile = (profile, shouldSpeak = true) => {
    const profiles = {
      "baixa-visao": {
        theme: "alto",
        fontSize: 26,
        motion: "",
        message: "Perfil baixa visão aplicado: texto maior e alto contraste.",
      },
      daltonismo: {
        theme: "protanopia",
        fontSize: 22,
        motion: "",
        message: "Perfil para daltonismo aplicado: cores diferenciadas e texto ampliado.",
      },
      leitor: {
        theme: "escuro",
        fontSize: 24,
        motion: "",
        message: "Perfil para leitor de tela aplicado: leitura linear, foco destacado e texto maior.",
      },
      movimento: {
        theme: tema.value,
        fontSize: Number(tamanho.value),
        motion: "reduced",
        message: "Perfil pouco movimento aplicado: animações e transições foram reduzidas.",
      },
    };
    const selected = profiles[profile];
    if (!selected) return;

    tema.value = selected.theme;
    tamanho.value = selected.fontSize;
    document.body.dataset.profile = profile;
    document.body.dataset.motion = selected.motion;
    updateTheme();
    updateFontSize();
    setProfileButtonState(profile);
    perfilStatus.textContent = selected.message;
    if (shouldSpeak) speak(selected.message, { interrupt: true });
  };

  const restorePreferences = () => {
    try {
      const stored = JSON.parse(localStorage.getItem("incluiPlayPreferences") || "null");
      if (!stored) return;

      if (supportedThemes.includes(stored.theme)) tema.value = stored.theme;
      const fontSize = Number(stored.fontSize);
      if (fontSize >= Number(tamanho.min) && fontSize <= Number(tamanho.max)) tamanho.value = fontSize;
      if (stored.profile) {
        document.body.dataset.profile = stored.profile;
        setProfileButtonState(stored.profile);
      }
      if (stored.motion === "reduced") document.body.dataset.motion = "reduced";
    } catch {
      // Preferências são opcionais e não devem impedir a abertura do jogo.
    }
  };

  const activateTab = (viewId, shouldSpeak = true) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.view === viewId;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    views.forEach((view) => {
      const visible = view.id === viewId;
      view.hidden = !visible;
      view.classList.toggle("is-visible", visible);
    });

    const heading = document.querySelector(`#${viewId} h2`);
    if (heading) {
      heading.focus();
      if (shouldSpeak) speak(heading.textContent, { interrupt: true });
    }
  };

  const updateNumberScore = () => {
    $("placar-numero").textContent = `Acertos: ${estado.numero.hits}. Erros: ${estado.numero.misses}.`;
  };

  const newNumber = () => {
    estado.numero.current = randomInt(1, 9);
    setStatus("status-numero", "Novo número falado. Escolha uma opção.");
    speak(`Número ${estado.numero.current}`, { interrupt: true });
  };

  const checkNumber = (value) => {
    if (estado.numero.current == null) {
      newNumber();
      return;
    }

    const ok = Number(value) === estado.numero.current;
    if (ok) {
      estado.numero.hits += 1;
      setStatus("status-numero", `Correto. O número era ${estado.numero.current}.`, "correct");
      speak(`Correto. O número era ${estado.numero.current}.`);
    } else {
      estado.numero.misses += 1;
      setStatus("status-numero", `Não foi dessa vez. O número era ${estado.numero.current}.`, "wrong");
      speak(`Não foi dessa vez. O número era ${estado.numero.current}.`);
    }

    updateNumberScore();
    estado.numero.current = null;
  };

  const pads = [
    { label: "sino grave", freq: 220, type: "sine" },
    { label: "toque médio", freq: 330, type: "triangle" },
    { label: "pulso agudo", freq: 523, type: "square" },
    { label: "eco curto", freq: 660, type: "sawtooth" },
  ];

  let audioCtx;
  const playPadSound = async (index) => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    await audioCtx.resume();

    const pad = pads[index];
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = pad.type;
    osc.frequency.value = pad.freq;
    gain.gain.value = 0.0001;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.16, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.45);
    osc.stop(audioCtx.currentTime + 0.5);
  };

  const updateMemoryScore = () => {
    $("placar-memoria").textContent = `Rodada ${estado.memoria.round}. Melhor resultado: ${estado.memoria.best}.`;
  };

  const playMemorySequence = async () => {
    if (!estado.memoria.sequence.length) {
      setStatus("status-memoria", "Pressione iniciar rodada para jogar.");
      speak("Pressione iniciar rodada para jogar.", { interrupt: true });
      return;
    }

    estado.memoria.accepting = false;
    setStatus("status-memoria", `Escute a sequência com ${estado.memoria.sequence.length} sons.`);
    await speak(`Sequência com ${estado.memoria.sequence.length} sons.`, { interrupt: true });

    for (const index of estado.memoria.sequence) {
      await wait(260);
      await playPadSound(index);
      await speak(`Som ${index + 1}, ${pads[index].label}.`);
    }

    estado.memoria.accepting = true;
    setStatus("status-memoria", "Sua vez. Repita a sequência.");
    speak("Sua vez. Repita a sequência.");
  };

  const nextMemoryRound = () => {
    estado.memoria.round += 1;
    estado.memoria.input = [];
    estado.memoria.sequence.push(randomInt(0, 3));
    updateMemoryScore();
    playMemorySequence();
  };

  const handleMemoryInput = async (index) => {
    if (!estado.memoria.accepting) return;

    estado.memoria.input.push(index);
    await playPadSound(index);
    const currentStep = estado.memoria.input.length - 1;

    if (estado.memoria.sequence[currentStep] !== index) {
      estado.memoria.best = Math.max(estado.memoria.best, estado.memoria.round - 1);
      estado.memoria.sequence = [];
      estado.memoria.round = 0;
      estado.memoria.input = [];
      estado.memoria.accepting = false;
      updateMemoryScore();
      setStatus("status-memoria", "Sequência errada. Tente uma nova rodada.", "wrong");
      speak("Sequência errada. Tente uma nova rodada.", { interrupt: true });
      return;
    }

    if (estado.memoria.input.length === estado.memoria.sequence.length) {
      estado.memoria.best = Math.max(estado.memoria.best, estado.memoria.round);
      estado.memoria.accepting = false;
      updateMemoryScore();
      setStatus("status-memoria", "Parabéns. Você completou a rodada.", "correct");
      speak("Parabéns. Você completou a rodada.");
    }
  };

  const updateRotaScore = () => {
    $("placar-rota").textContent = `Acertos: ${estado.rota.hits}. Erros: ${estado.rota.misses}.`;
  };

  const novaRota = (interrupt = true) => {
    const dirs = ["cima", "esquerda", "direita", "baixo"];
    estado.rota.current = dirs[randomInt(0, dirs.length - 1)];
    setStatus("status-rota", `Direção alvo: ${estado.rota.current}. Escolha a mesma.`);
    speak(`Direção alvo ${estado.rota.current}.`, { interrupt });
  };

  const checkRota = (dir) => {
    if (!estado.rota.current) {
      novaRota();
      return;
    }

    const ok = dir === estado.rota.current;
    if (ok) {
      estado.rota.hits += 1;
      setStatus("status-rota", `Correto. A direção era ${estado.rota.current}.`, "correct");
      speak(`Correto. A direção era ${estado.rota.current}.`, { interrupt: true });
      setTimeout(() => novaRota(false), 1100);
    } else {
      estado.rota.misses += 1;
      setStatus("status-rota", `Errado. A direção era ${estado.rota.current}.`, "wrong");
      speak(`Errado. A direção era ${estado.rota.current}. Tente novamente.`, { interrupt: true });
    }

    updateRotaScore();
  };

  const readCurrentPage = () => {
    const visibleView = views.find((view) => !view.hidden);
    const title = visibleView?.querySelector("h2")?.textContent || "IncluiPlay";
    const description = visibleView?.querySelector(".section-head p")?.textContent.trim() || "";
    speak(`${title}. ${description}`, { interrupt: true });
  };

  const guideCurrentView = () => {
    const visibleId = views.find((view) => !view.hidden)?.id;
    const guides = {
      numero: "Você está no jogo Número falado. Pressione Falar número e escolha de 1 a 9 pelos botões ou pelo teclado numérico. Use Repetir número se precisar ouvir de novo.",
      memoria: "Você está no jogo Memória sonora. Pressione Iniciar rodada, escute os sons e repita a sequência pelos botões ou pelas teclas de um a quatro.",
      orientacao: "Você está no jogo Rota segura. Pressione Nova direção e escolha cima, baixo, esquerda ou direita pelos botões ou pelas setas do teclado.",
      acessibilidade: "Você está no teste de acessibilidade. Pressione Executar teste agora para conferir teclado, tema, texto alternativo, voz e recursos para leitor de tela.",
      apresentacao: "Você está na apresentação do IncluiPlay. Esta tela explica o público, os recursos de acessibilidade e o objetivo dos três jogos.",
    };
    const text = guides[visibleId] || "Você está no IncluiPlay. Escolha uma aba para começar.";
    setAssistantStatus("Guia por voz iniciado.");
    speak(text, { interrupt: true });
  };

  const startCurrentGame = () => {
    const visibleId = views.find((view) => !view.hidden)?.id;
    if (visibleId === "numero") return newNumber();
    if (visibleId === "memoria") return nextMemoryRound();
    if (visibleId === "orientacao") return novaRota();
    speak("Escolha um dos três jogos para começar.", { interrupt: true });
  };

  const repeatCurrentGame = () => {
    const visibleId = views.find((view) => !view.hidden)?.id;
    if (visibleId === "numero") {
      if (estado.numero.current == null) return newNumber();
      setStatus("status-numero", "Número repetido.");
      return speak(`Número ${estado.numero.current}`, { interrupt: true });
    }
    if (visibleId === "memoria") return playMemorySequence();
    if (visibleId === "orientacao") {
      if (!estado.rota.current) return novaRota();
      setStatus("status-rota", `Direção repetida: ${estado.rota.current}.`);
      return speak(`Direção alvo ${estado.rota.current}.`, { interrupt: true });
    }
    guideCurrentView();
  };

  const goToNextGame = () => {
    const visibleId = views.find((view) => !view.hidden)?.id;
    const currentIndex = gameViews.indexOf(visibleId);
    const nextId = gameViews[currentIndex < 0 ? 0 : (currentIndex + 1) % gameViews.length];
    activateTab(nextId);
  };

  const answerNumberFromVoice = (command) => {
    const digit = command.match(/\b([1-9])\b/)?.[1];
    const words = {
      um: 1,
      dois: 2,
      tres: 3,
      quatro: 4,
      cinco: 5,
      seis: 6,
      sete: 7,
      oito: 8,
      nove: 9,
    };
    const word = Object.keys(words).find((name) => new RegExp(`\\b${name}\\b`).test(command));
    return digit || (word ? String(words[word]) : null);
  };

  const setAuditResult = (id, status, detail) => {
    const item = $(id);
    const badge = item.querySelector(".audit-status");
    const description = item.querySelector("span:last-child");
    item.classList.remove("is-pass", "is-attention");
    item.classList.add(status === "pass" ? "is-pass" : "is-attention");
    badge.textContent = status === "pass" ? "Pronto" : "Atenção";
    description.textContent = detail;
  };

  const runAccessibilityTest = () => {
    const keyboardControls = Array.from(document.querySelectorAll("button, select, input"));
    const allKeyboardReady = keyboardControls.length > 0 && keyboardControls.every((control) => control.tabIndex >= 0);
    const images = Array.from(document.images);
    const allImagesDescribed = images.every((image) => image.hasAttribute("alt"));
    const screenReaderReady = Boolean(
      document.documentElement.lang
      && document.querySelector(".skip-link")
      && document.querySelector("[aria-live]")
      && document.querySelector("main")
    );
    const voiceReady = "speechSynthesis" in window;

    setAuditResult("teste-contraste", "pass", `Tema ${tema.options[tema.selectedIndex].text} aplicado com cores próprias.`);
    setAuditResult("teste-teclado", allKeyboardReady ? "pass" : "attention", allKeyboardReady
      ? `${keyboardControls.length} controles podem receber foco pelo teclado.`
      : "Alguns controles não podem receber foco pelo teclado.");
    setAuditResult("teste-alt", allImagesDescribed ? "pass" : "attention", images.length
      ? (allImagesDescribed ? "Todas as imagens encontradas possuem atributo alt." : "Há imagem sem texto alternativo.")
      : "Não há imagens no conteúdo atual que precisem de texto alternativo.");
    setAuditResult("teste-voz", voiceReady ? "pass" : "attention", voiceReady
      ? "Leitura por voz está disponível neste navegador. O microfone depende do navegador."
      : "Este navegador não oferece leitura por voz.");
    setAuditResult("teste-leitor", screenReaderReady ? "pass" : "attention", screenReaderReady
      ? "Idioma, atalho para conteúdo, rótulos e regiões de anúncio foram encontrados."
      : "Faltam alguns recursos estruturais para leitores de tela.");
    $("teste-atualizado").textContent = "Verificação concluída agora.";
  };

  const setAssistantStatus = (text) => {
    assistenteStatus.textContent = text;
  };

  const answerOfflineQuestion = (question) => {
    const answers = {
      texto: "Use o controle Tamanho do texto no painel de ajustes. Você também pode dizer aumentar texto ou diminuir texto.",
      teclado: "Use Tab para avançar entre controles, Enter ou Espaço para ativar botões, as teclas de um a nove no jogo de números e as setas na Rota segura.",
      "baixa-visao": "O jogo Número falado é uma boa opção para começar: ele combina voz, texto grande, alto contraste e respostas pelo teclado.",
    };
    assistantAnswer.textContent = answers[question] || "Escolha uma das perguntas para ouvir uma resposta.";
  };

  const handleAssistantCommand = (rawCommand) => {
    const command = rawCommand.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    setAssistantStatus(`Comando entendido: ${rawCommand}`);

    if (command.includes("ajuda")) {
      speak("Você pode dizer: ler instruções, guia, jogo um, próximo jogo, iniciar jogo, repetir, responder três, aumentar texto, tema escuro, alto contraste ou tema daltonismo.", { interrupt: true });
      return;
    }

    if (command.includes("guia")) {
      guideCurrentView();
      return;
    }

    if (command.includes("proximo jogo") || command.includes("proxima jogo")) {
      goToNextGame();
      return;
    }

    if (command.includes("responder") || command.includes("resposta")) {
      const answer = answerNumberFromVoice(command);
      if (answer && views.find((view) => !view.hidden)?.id === "numero") {
        checkNumber(answer);
        return;
      }
      speak("Para responder por voz, abra o jogo Número falado e diga responder seguido de um número de um a nove.", { interrupt: true });
      return;
    }

    if (command.includes("iniciar") || command.includes("comecar") || command.includes("começar")) {
      startCurrentGame();
      return;
    }

    if (command.includes("repetir")) {
      repeatCurrentGame();
      return;
    }

    if (command.includes("ler") || command.includes("instrucoes")) {
      readCurrentPage();
      return;
    }

    if (command.includes("jogo um") || command.includes("numero")) {
      activateTab("numero");
      return;
    }

    if (command.includes("jogo dois") || command.includes("memoria")) {
      activateTab("memoria");
      return;
    }

    if (command.includes("jogo tres") || command.includes("rota") || command.includes("direcao")) {
      activateTab("orientacao");
      return;
    }

    if (command.includes("aumentar")) {
      tamanho.value = Math.min(Number(tamanho.max), Number(tamanho.value) + 2);
      updateFontSize();
      speak("Texto aumentado.", { interrupt: true });
      return;
    }

    if (command.includes("diminuir")) {
      tamanho.value = Math.max(Number(tamanho.min), Number(tamanho.value) - 2);
      updateFontSize();
      speak("Texto diminuído.", { interrupt: true });
      return;
    }

    if (command.includes("alto contraste")) {
      tema.value = "alto";
      updateTheme();
      speak("Alto contraste ativado.", { interrupt: true });
      return;
    }

    if (command.includes("escuro")) {
      tema.value = "escuro";
      updateTheme();
      speak("Tema escuro ativado.", { interrupt: true });
      return;
    }

    if (command.includes("claro")) {
      tema.value = "claro";
      updateTheme();
      speak("Tema claro ativado.", { interrupt: true });
      return;
    }

    if (command.includes("daltonismo") || command.includes("daltonico")) {
      tema.value = "protanopia";
      updateTheme();
      speak("Tema para daltonismo ativado.", { interrupt: true });
      return;
    }

    speak("Ainda não entendi esse comando. Diga ajuda para ouvir as opções.", { interrupt: true });
  };

  const setupSpeechRecognition = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      btnOuvir.disabled = true;
      setAssistantStatus("Microfone por voz não suportado neste navegador. Use Chrome ou Edge.");
      return;
    }

    estado.recognition = new Recognition();
    estado.recognition.lang = "pt-BR";
    estado.recognition.interimResults = false;
    estado.recognition.maxAlternatives = 1;

    estado.recognition.onstart = () => setAssistantStatus("Ouvindo...");
    estado.recognition.onerror = () => {
      setAssistantStatus("Não consegui ouvir. Tente de novo perto do microfone.");
      speak("Não consegui ouvir. Tente de novo.", { interrupt: true });
    };
    estado.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      handleAssistantCommand(transcript);
    };
  };

  tabs.forEach((tab) => tab.addEventListener("click", () => activateTab(tab.dataset.view)));

  $("novo-numero").addEventListener("click", newNumber);
  $("repetir-numero").addEventListener("click", () => {
    repeatCurrentGame();
  });
  document.querySelectorAll(".number-btn").forEach((btn) =>
    btn.addEventListener("click", () => checkNumber(btn.dataset.number))
  );

  $("iniciar-memoria").addEventListener("click", nextMemoryRound);
  $("repetir-sequencia").addEventListener("click", repeatCurrentGame);
  document.querySelectorAll(".sound-pad").forEach((btn) =>
    btn.addEventListener("click", () => handleMemoryInput(Number(btn.dataset.pad)))
  );

  $("nova-rota").addEventListener("click", () => novaRota());
  document.querySelectorAll(".dir-btn").forEach((btn) =>
    btn.addEventListener("click", () => checkRota(btn.dataset.dir))
  );

  document.addEventListener("keydown", (event) => {
    if (event.target.matches("input, select, textarea")) return;

    const visibleView = views.find((view) => !view.hidden)?.id;
    if (/^[1-9]$/.test(event.key)) {
      if (visibleView === "numero") checkNumber(event.key);
      if (visibleView === "memoria" && Number(event.key) <= 4) handleMemoryInput(Number(event.key) - 1);
      return;
    }

    if (visibleView === "orientacao") {
      const map = {
        ArrowUp: "cima",
        ArrowLeft: "esquerda",
        ArrowRight: "direita",
        ArrowDown: "baixo",
      };
      if (map[event.key]) checkRota(map[event.key]);
    }
  });

  tema.addEventListener("change", updateTheme);
  tamanho.addEventListener("input", updateFontSize);
  btnFala.addEventListener("click", () => speak("Acessibilidade ativada. Teste de voz em velocidade confortável.", { interrupt: true }));
  btnGuia.addEventListener("click", guideCurrentView);
  profileButtons.forEach((button) => button.addEventListener("click", () => applyProfile(button.dataset.profile)));
  questionButtons.forEach((button) => button.addEventListener("click", () => answerOfflineQuestion(button.dataset.question)));
  btnAjudaVoz.addEventListener("click", () => handleAssistantCommand("ajuda"));
  btnOuvir.addEventListener("click", () => {
    if (estado.recognition) estado.recognition.start();
  });
  vozSelect.addEventListener("change", () => speak("Voz selecionada.", { interrupt: true }));
  $("executar-teste").addEventListener("click", runAccessibilityTest);

  if ("speechSynthesis" in window) {
    speechSynthesis.addEventListener?.("voiceschanged", refreshVoices);
    refreshVoices();
    btnFala.disabled = false;
  } else {
    btnFala.disabled = true;
  }

  setupSpeechRecognition();
  restorePreferences();
  updateTheme();
  updateFontSize();
  updateNumberScore();
  updateMemoryScore();
  updateRotaScore();
  runAccessibilityTest();
})();
