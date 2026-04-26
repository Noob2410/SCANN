const manualInput = document.getElementById("manualInput");
const targetList = document.getElementById("targetList");
const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const scanInput = document.getElementById("scanInput");
const scanPanel = document.getElementById("scanPanel");
const counter = document.getElementById("counter");
const foundList = document.getElementById("foundList");
const logList = document.getElementById("logList");
const logBox = document.getElementById("logBox");
const toggleLogBtn = document.getElementById("toggleLogBtn");
const downloadLogBtn = document.getElementById("downloadLogBtn");
const clearBtn = document.getElementById("clearBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");

let targets = [];
let found = [];
let logs = [];
let totalLoaded = 0;
let focusTimer = null;

function nowString() {
  return new Date().toLocaleString("ru-RU");
}

function normalizeNumber(value) {
  if (value === null || value === undefined) return "";

  let text = String(value).trim();
  if (!text) return "";

  const qrMatch = text.match(/\$1:1:(\d+):/);
  if (qrMatch) return qrMatch[1];

  text = text.replace(/\s+/g, "");

  const plainMatch = text.match(/\d+/);
  return plainMatch ? plainMatch[0] : "";
}

function splitNumbers(text) {
  return String(text)
    .split(/\r?\n/)
    .map(normalizeNumber)
    .filter(Boolean);
}

function addLog(status, number, raw = "") {
  const line = `[${nowString()}] ${status}: ${number}${raw && raw !== number ? ` | RAW: ${raw}` : ""}`;
  logs.unshift(line);
}

function addTargets(numbers) {
  const clean = numbers.map(normalizeNumber).filter(Boolean);
  if (!clean.length) return;

  targets.push(...clean);
  totalLoaded += clean.length;

  clean.forEach((num) => addLog("ЗАГРУЖЕНО", num));
  render();
}

function removeOneTarget(number) {
  const index = targets.indexOf(number);
  if (index === -1) return false;

  targets.splice(index, 1);
  found.push(number);
  return true;
}

function render() {
  targetList.value = targets.join("\n");
  foundList.value = found.map((num) => `НАЙДЕНО: ${num}`).join("\n");
  logList.value = logs.join("\n");

  counter.textContent = `Найдено: ${found.length} / ${totalLoaded} | Осталось: ${targets.length}`;
}

function flash(status) {
  scanPanel.classList.remove("good", "bad");
  scanPanel.classList.add(status);

  setTimeout(() => {
    scanPanel.classList.remove("good", "bad");
  }, 650);
}

function beep(type) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const audio = new AudioContextClass();

  function tone(freq, start, duration, volume = 0.2) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.connect(gain);
    gain.connect(audio.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(freq, audio.currentTime + start);

    gain.gain.setValueAtTime(volume, audio.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + start + duration);

    oscillator.start(audio.currentTime + start);
    oscillator.stop(audio.currentTime + start + duration);
  }

  if (type === "good") {
    tone(880, 0, 0.10, 0.22);
    tone(1180, 0.12, 0.10, 0.22);
  } else {
    tone(180, 0, 0.28, 0.25);
    tone(140, 0.12, 0.28, 0.18);
  }
}

function handleScan(rawValue) {
  const raw = String(rawValue || "").trim();
  const number = normalizeNumber(raw);

  if (!number) {
    scanInput.value = "";
    keepScannerFocus();
    return;
  }

  const ok = removeOneTarget(number);

  if (ok) {
    addLog("НАЙДЕНО", number, raw);
    flash("good");
    beep("good");
  } else {
    addLog("НЕ НАЙДЕНО", number, raw);
    flash("bad");
    beep("bad");
  }

  render();
  scanInput.value = "";
  keepScannerFocus();
}

function keepScannerFocus() {
  if (document.activeElement !== manualInput) {
    scanInput.focus();
  }
}

function scheduleScannerFocusAfterManualInput() {
  clearTimeout(focusTimer);
  focusTimer = setTimeout(() => {
    scanInput.focus();
  }, 5000);
}

manualInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.shiftKey) {
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    addTargets(splitNumbers(manualInput.value));
    manualInput.value = "";
    scanInput.focus();
  }
});

manualInput.addEventListener("input", scheduleScannerFocusAfterManualInput);
manualInput.addEventListener("focus", scheduleScannerFocusAfterManualInput);
manualInput.addEventListener("click", scheduleScannerFocusAfterManualInput);
manualInput.addEventListener("keydown", scheduleScannerFocusAfterManualInput);

// Поле 4 адаптировано под сканер:
// сканер вводит номер/QR и сам нажимает Enter — проверка запускается сразу по Enter.
// При ручном вводе ничего автоматически не срабатывает.
// Для ручной проверки можно нажать кнопку "Проверить".
scanInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleScan(scanInput.value);
  }
});



fileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  fileName.textContent = file.name;
  const extension = file.name.split(".").pop().toLowerCase();

  try {
    if (extension === "csv") {
      const text = await file.text();
      addTargets(splitNumbers(text.replace(/[;,]/g, "\n")));
      fileInput.value = "";
      return;
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const numbers = [];

    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

      rows.forEach((row) => {
        row.forEach((cell) => {
          const number = normalizeNumber(cell);
          if (number) numbers.push(number);
        });
      });
    });

    addTargets(numbers);
  } catch (error) {
    alert("Не получилось прочитать файл. Попробуй сохранить таблицу как .xlsx или .csv");
    addLog("ОШИБКА ФАЙЛА", file.name);
  }

  fileInput.value = "";
  render();
});

toggleLogBtn.addEventListener("click", (event) => {
  event.stopPropagation();

  const expanded = logBox.classList.toggle("expanded");
  logBox.classList.toggle("collapsed", !expanded);
  toggleLogBtn.textContent = expanded ? "Журнал логов ▲" : "Журнал логов ▼";
});

downloadLogBtn.addEventListener("click", () => {
  const content = [
    "ЛОГ СВЕРКИ QR / ШТРИХКОДОВ",
    `Дата выгрузки: ${nowString()}`,
    "",
    `Всего загружено: ${totalLoaded}`,
    `Найдено: ${found.length}`,
    `Осталось: ${targets.length}`,
    "",
    "--- НАЙДЕННЫЕ ---",
    ...found,
    "",
    "--- ОСТАЛОСЬ НАЙТИ ---",
    ...targets,
    "",
    "--- ПОЛНЫЙ ЛОГ ---",
    ...logs
  ].join("\n");

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `log-qr-${new Date().toISOString().slice(0, 10)}.txt`;
  link.click();

  URL.revokeObjectURL(url);
  scanInput.focus();
});

clearBtn.addEventListener("click", () => {
  const ok = confirm("Точно очистить все списки и лог?");
  if (!ok) return;

  targets = [];
  found = [];
  logs = [];
  totalLoaded = 0;
  manualInput.value = "";
  scanInput.value = "";
  fileName.textContent = "Файл не выбран";
  render();
  scanInput.focus();
});

fullscreenBtn.addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    alert("Браузер не дал включить полноэкранный режим. Попробуй нажать F11.");
  }

  scanInput.focus();
});

document.addEventListener("fullscreenchange", () => {
  const isFull = Boolean(document.fullscreenElement);
  document.body.classList.toggle("fullscreen-mode", isFull);
  fullscreenBtn.textContent = isFull ? "Выйти из экрана" : "На весь экран";
  scanInput.focus();
});

document.addEventListener("click", () => {
  if (document.activeElement !== manualInput) {
    scanInput.focus();
  }
});

window.addEventListener("load", () => {
  render();
  scanInput.focus();
});
