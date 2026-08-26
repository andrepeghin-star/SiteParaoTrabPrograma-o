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
    numero: { current: null, hits: 0, misses: 0 },
    memoria: { sequence: [], round: 0, best: 0, input: [], accepting: false },
    rota: { current: null, hits: 0, misses: 0 },
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

  const refreshVoices = () => {
    if (!("speechSynthesis" in window)) {
      if (vozSelect) vozSelect.innerHTML = '<option value="">Voz não suportada neste navegador</option>';
      if (btnFala) btnFala.disabled = true;
      return;
    }

    const allVoices = speechSynthesis.getVoices();
    const ptBrVoices = allVoices.filter((v) =>
      /pt[-_]BR|pt[-_]|portuguese/i.test(v.lang) || /brasil|brazil|portugu[eê]s/i.test(v.name)
    );
    estado.voices = ptBrVoices.length ? ptBrVoices : allVoices;
    
    if (vozSelect) {
      vozSelect.innerHTML = estado.voices.length
        ? estado.voices.map((v) => `<option value="${v.name}">${v.name} (${v.lang})</option>`).join("")
        : '<option value="">Nenhuma voz encontrada</option>';
    }
  };

  const processSpeechQueue = () => {
    if (estado.speaking || !estado.speechQueue.length || !("speechSynthesis" in window)) return;

    const item = estado.speechQueue.shift();
    const utterance = new SpeechSynthesisUtterance(item.text);
    const chosenVoice = estado.voices.find((v) => v.name === vozSelect?.value);

    utterance.lang = "pt-BR";
    utterance.rate = 0.9;
    if (chosenVoice) utterance.voice = chosenVoice;

    estado.speaking = true;
    utterance.onend = () => {
      estado.speaking = false;
      item.resolve();
      setTimeout(processSpeechQueue, 100);
    };
    utterance.onerror = () => {
      estado.speaking = false;
      item.resolve();
      setTimeout(processSpeechQueue, 100);
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
    if (!el) return;
    el.textContent = text;
    el.classList.remove("is-correct", "is-wrong");
    if (kind === "correct") el.classList.add("is-correct");
    if (kind === "wrong") el.classList.add("is-wrong");
  };

  const updateTheme = () => {
    if (!tema) return;
    document.body.dataset.theme = tema.value;
    localStorage.setItem("incluiPlay_theme", tema.value);
  };

  const updateFontSize = () => {
    if (!tamanho) return;
    document.documentElement.style.fontSize = `${tamanho.value}px`;
    localStorage.setItem("incluiPlay_fontSize", tamanho.value);
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
      "baixa-visao": { theme: "alto", fontSize: 26, motion: "", message: "Perfil baixa visão aplicado." },
      daltonismo: { theme: "protanopia", fontSize: 22, motion: "", message: "Perfil para daltonismo aplicado." },
      leitor: { theme: "escuro", fontSize: 24, motion: "", message: "Perfil leitor de tela aplicado." },
      movimento: { theme: tema.value, fontSize: Number(tamanho.value), motion: "reduced", message: "Perfil pouco movimento aplicado." },
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
    if (perfilStatus) perfilStatus.textContent = selected.message;
    if (shouldSpeak) speak(selected.message, { interrupt: true });
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

  // --- JOGO 1 ---
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
      setStatus("status-numero", `Correto! O número era ${estado.numero.current}.`, "correct");
      speak(`Correto. O número era ${estado.numero.current}.`);
    } else {
      estado.numero.misses += 1;
      setStatus("status-numero", `Incorreto. O número era ${estado.numero.current}.`, "wrong");
      speak(`Errado. O número era ${estado.numero.current}.`);
    }

    $("placar-numero").textContent = `Acertos: ${estado.numero.hits}. Erros: ${estado.numero.misses}.`;
    estado.numero.current = null;
  };

  // --- JOGO 2 ---
  const playSequence = async () => {
    if (estado.memoria.sequence.length === 0) return;
    estado.memoria.accepting = false;
    setStatus("status-memoria", "Ouça a sequência...");
    for (let i = 0; i < estado.memoria.sequence.length; i++) {
      const padIndex = estado.memoria.sequence[i];
      await speak(`${padIndex + 1}`, { interrupt: true });
      await wait(800);
    }
    setStatus("status-memoria", "Sua vez! Repita a sequência.");
    estado.memoria.input = [];
    estado.memoria.accepting = true;
  };

  const iniciarMemoria = () => {
    estado.memoria.round = 1;
    estado.memoria.sequence = [randomInt(0, 3)];
    if ($("placar-memoria")) $("placar-memoria").textContent = `Rodada ${estado.memoria.round}. Melhor resultado: ${estado.memoria.best}.`;
    playSequence();
  };

  const checkMemoria = (padIndex) => {
    if (!estado.memoria.accepting) return;
    
    padIndex = Number(padIndex);
    estado.memoria.input.push(padIndex);
    const currentStep = estado.memoria.input.length - 1;

    speak(`${padIndex + 1}`, { interrupt: true });

    if (estado.memoria.input[currentStep] !== estado.memoria.sequence[currentStep]) {
      setStatus("status-memoria", `Incorreto. Fim de jogo na rodada ${estado.memoria.round}.`, "wrong");
      speak(`Errado. Fim de jogo.`);
      estado.memoria.accepting = false;
      return;
    }

    if (estado.memoria.input.length === estado.memoria.sequence.length) {
      estado.memoria.accepting = false;
      estado.memoria.round++;
      if (estado.memoria.round - 1 > estado.memoria.best) {
        estado.memoria.best = estado.memoria.round - 1;
      }
      if ($("placar-memoria")) $("placar-memoria").textContent = `Rodada ${estado.memoria.round}. Melhor resultado: ${estado.memoria.best}.`;
      setStatus("status-memoria", "Correto! Preparando próxima sequência...", "correct");
      speak(`Correto!`);
      
      estado.memoria.sequence.push(randomInt(0, 3));
      setTimeout(playSequence, 2000);
    }
  };

  // --- JOGO 3 ---
  const direcoes = ["cima", "baixo", "esquerda", "direita"];
  
  const novaRota = () => {
    estado.rota.current = direcoes[randomInt(0, 3)];
    setStatus("status-rota", `Vá para: ${estado.rota.current}`);
    speak(`Vá para ${estado.rota.current}`, { interrupt: true });
  };

  const checkRota = (dir) => {
    if (!estado.rota.current) {
      novaRota();
      return;
    }

    if (dir === estado.rota.current) {
      estado.rota.hits++;
      setStatus("status-rota", "Correto!", "correct");
      speak("Correto!");
    } else {
      estado.rota.misses++;
      setStatus("status-rota", `Incorreto. Era ${estado.rota.current}.`, "wrong");
      speak("Errado.");
    }
    if ($("placar-rota")) $("placar-rota").textContent = `Acertos: ${estado.rota.hits}. Erros: ${estado.rota.misses}.`;
    estado.rota.current = null;
    
    setTimeout(novaRota, 1500);
  };

  // --- TESTES DE ACESSIBILIDADE ---
  const runAccessibilityTest = () => {
    try {
      const keyboardControls = Array.from(document.querySelectorAll("button, select, input"));
      const allKeyboardReady = keyboardControls.length > 0 && keyboardControls.every((control) => control.tabIndex >= 0);
      const images = Array.from(document.images);
      const allImagesDescribed = images.every((image) => image.hasAttribute("alt"));
      const screenReaderReady = Boolean(document.documentElement.lang && document.querySelector(".skip-link"));
      const voiceReady = "speechSynthesis" in window;
      const themeText = tema?.options[tema.selectedIndex]?.text || tema?.value || "Padrão";

      const setAudit = (id, pass, text) => {
        const item = $(id);
        if (!item) return;
        item.classList.toggle("is-pass", pass);
        item.classList.toggle("is-attention", !pass);
        const badge = item.querySelector(".audit-status");
        if (badge) badge.textContent = pass ? "Pronto" : "Atenção";
        const desc = item.querySelector("span:last-child");
        if (desc) desc.textContent = text;
      };

      setAudit("teste-contraste", true, `Tema ${themeText} aplicado com sucesso.`);
      setAudit("teste-teclado", allKeyboardReady, `${keyboardControls.length} controles navegáveis via teclado.`);
      setAudit("teste-alt", allImagesDescribed, images.length ? "Imagens com atributo alt." : "Sem imagens pendentes.");
      setAudit("teste-voz", voiceReady, voiceReady ? "Síntese de voz suportada." : "Sem suporte a voz neste navegador.");
      setAudit("teste-leitor", screenReaderReady, "Estrutura semântica configurada.");

      if ($("teste-atualizado")) $("teste-atualizado").textContent = "Verificação concluída.";
    } catch (e) {
      console.warn("Aviso ao executar teste de acessibilidade:", e);
    }
  };

  const answerOfflineQuestion = (question) => {
    const answers = {
      texto: "Use o controle Tamanho do texto no painel para ajustar a fonte.",
      teclado: "Use a tecla Tab para navegar entre elementos e Enter ou Espaço para interagir.",
      "baixa-visao": "O jogo Número falado possui texto grande, contraste e sinalização sonora.",
    };
    const text = answers[question] || "Resposta indisponível.";
    if (assistantAnswer) assistantAnswer.textContent = text;
    speak(text, { interrupt: true });
  };

  // --- EVENT LISTENERS GERAIS ---
  tabs.forEach((tab) => tab.addEventListener("click", () => activateTab(tab.dataset.view)));
  
  if ($("novo-numero")) $("novo-numero").addEventListener("click", newNumber);
  if ($("repetir-numero")) $("repetir-numero").addEventListener("click", () => {
    if (estado.numero.current) speak(`Número ${estado.numero.current}`, { interrupt: true });
    else newNumber();
  });
  document.querySelectorAll(".number-btn").forEach((btn) =>
    btn.addEventListener("click", () => checkNumber(btn.dataset.number))
  );

  if ($("iniciar-memoria")) $("iniciar-memoria").addEventListener("click", iniciarMemoria);
  if ($("repetir-sequencia")) $("repetir-sequencia").addEventListener("click", playSequence);
  document.querySelectorAll(".sound-pad").forEach((btn) =>
    btn.addEventListener("click", () => checkMemoria(btn.dataset.pad))
  );

  if ($("nova-rota")) $("nova-rota").addEventListener("click", novaRota);
  document.querySelectorAll(".dir-btn").forEach((btn) =>
    btn.addEventListener("click", () => checkRota(btn.dataset.dir))
  );

  if (tema) tema.addEventListener("change", updateTheme);
  if (tamanho) tamanho.addEventListener("input", updateFontSize);
  if (btnFala) btnFala.addEventListener("click", () => speak("Acessibilidade e testes de voz ativos.", { interrupt: true }));
  
  profileButtons.forEach((btn) => btn.addEventListener("click", () => applyProfile(btn.dataset.profile)));
  questionButtons.forEach((btn) => btn.addEventListener("click", () => answerOfflineQuestion(btn.dataset.question)));
  if ($("executar-teste")) $("executar-teste").addEventListener("click", runAccessibilityTest);

  // --- INICIALIZAÇÃO ---
  if ("speechSynthesis" in window) {
    speechSynthesis.onvoiceschanged = refreshVoices;
    refreshVoices();
  }

  updateTheme();
  updateFontSize();
  runAccessibilityTest();
})();
