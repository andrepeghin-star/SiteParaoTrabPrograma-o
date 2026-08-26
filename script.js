(function () {
  const tema = document.getElementById("tema");
  const tamanho = document.getElementById("tamanho");
  const vozSelect = document.getElementById("voz");
  const btnFala = document.getElementById("btn-fala");
  const btnGuia = document.getElementById("btn-guia");
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const views = Array.from(document.querySelectorAll(".view"));
  const profileButtons = Array.from(document.querySelectorAll(".profile-btn"));
  const questionButtons = Array.from(document.querySelectorAll("[data-question]"));

  const estado = {
    numero: { current: null, hits: 0, misses: 0 },
    voices: []
  };

  const $ = (id) => document.getElementById(id);

  const refreshVoices = () => {
    if (!("speechSynthesis" in window)) return;
    const allVoices = speechSynthesis.getVoices();
    estado.voices = allVoices.filter((v) => /pt/i.test(v.lang)) || allVoices;
    if (vozSelect) {
      vozSelect.innerHTML = estado.voices.map((v) => `<option value="${v.name}">${v.name}</option>`).join("");
    }
  };

  const speak = (text) => {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    speechSynthesis.speak(utterance);
  };

  const activateTab = (viewId) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.view === viewId;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    views.forEach((view) => {
      view.hidden = view.id !== viewId;
      view.classList.toggle("is-visible", view.id === viewId);
    });
  };

  tabs.forEach((tab) => tab.addEventListener("click", () => activateTab(tab.dataset.view)));

  if ($("novo-numero")) {
    $("novo-numero").addEventListener("click", () => {
      estado.numero.current = Math.floor(Math.random() * 9) + 1;
      $("status-numero").textContent = "Número sorteado!";
      speak(`Número ${estado.numero.current}`);
    });
  }

  document.querySelectorAll(".number-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!estado.numero.current) return;
      if (Number(btn.dataset.number) === estado.numero.current) {
        estado.numero.hits++;
        speak("Acertou!");
        $("status-numero").textContent = "Correto!";
      } else {
        estado.numero.misses++;
        speak("Errou!");
        $("status-numero").textContent = "Incorreto!";
      }
      $("placar-numero").textContent = `Acertos: ${estado.numero.hits} | Erros: ${estado.numero.misses}`;
      estado.numero.current = null;
    });
  });

  if (tema) tema.addEventListener("change", () => document.body.dataset.theme = tema.value);
  if (tamanho) tamanho.addEventListener("input", () => document.documentElement.style.fontSize = `${tamanho.value}px`);
  if (btnFala) btnFala.addEventListener("click", () => speak("Sintetizador de voz ativo e funcionando."));

  questionButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const answers = {
        texto: "Ajuste o tamanho no controle deslizante no painel à direita.",
        teclado: "Navegue usando Tab e confirme com Enter ou Espaço.",
        "baixa-visao": "O Jogo 1 (Números) possui auto contraste e avisos sonoros."
      };
      const ans = answers[btn.dataset.question] || "";
      $("assistente-resposta").textContent = ans;
      speak(ans);
    });
  });

  if ("speechSynthesis" in window) {
    speechSynthesis.onvoiceschanged = refreshVoices;
    refreshVoices();
  }
})();