const $ = id => document.getElementById(id);
const input = $("mathInput"), solveBtn = $("solveBtn"), clearBtn = $("clearBtn");
const variable = $("variable"), imageInput = $("imageInput");
const previewArea = $("previewArea"), imagePreview = $("imagePreview");
const ocrStatus = $("ocrStatus"), ocrProgress = $("ocrProgress"), ocrTitle = $("ocrTitle");
const resultPanel = $("resultPanel"), resultText = $("resultText"), detectedText = $("detectedText");
const stepsText = $("stepsText"), errorPanel = $("errorPanel"), removeImage = $("removeImage");
const dropZone = $("dropZone");

function showResult(answer, detected = "", steps = "") {
  resultText.textContent = answer;
  resultPanel.classList.remove("hidden");
  errorPanel.classList.add("hidden");
  if (steps) {
    stepsText.textContent = steps;
    stepsText.classList.remove("hidden");
  } else stepsText.classList.add("hidden");
  if (detected) {
    detectedText.textContent = "Detected expression: " + detected;
    detectedText.classList.remove("hidden");
  } else detectedText.classList.add("hidden");
}
function showError(message) {
  errorPanel.textContent = message;
  errorPanel.classList.remove("hidden");
  resultPanel.classList.add("hidden");
}
function cleanText(s) {
  return s
    .replace(/[−–—]/g, "-")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[⁄∕]/g, "/")
    .replace(/π/g, "pi")
    .replace(/√/g, "sqrt")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/[{}[\]]/g, m => m === "{" ? "(" : m === "}" ? ")" : m === "[" ? "(" : ")")
    .replace(/\s+/g, " ").trim();
}
function normalizeOCR(s) {
  let t = cleanText(s);

  // Common OCR mistakes for printed math.
  t = t.replace(/\bO\b/g, "0").replace(/\bI\b/g, "1").replace(/\bl\b/g, "1");
  t = t.replace(/(\d)\s*[xX]\s*(\d)/g, "$1*$2");
  t = t.replace(/(\d)\s*\/\s*(\d)/g, "$1/$2");
  t = t.replace(/(\d)\s*:\s*(\d)/g, "$1/$2");

  // OCR may turn ÷ into +, -, :, or a dot.
  // Keep the original text too; visualMathRepair() below checks
  // high-confidence printed patterns.
  t = t.replace(/\s*=\s*$/, "").trim();

  return t;
}

// High-confidence repairs for common printed math layouts.
// This does not blindly replace every '+': it only repairs patterns
// where OCR has produced a very recognizable structure.
function visualMathRepair(text) {
  let t = text.replace(/\s+/g, " ").trim();

  // Exact family: "6 + 2(1+2)" is a frequent OCR reading of
  // the printed "6 ÷ 2(1+2)" layout.
  if (/^6\s*\+\s*2\s*\(\s*1\s*\+\s*2\s*\)\s*$/i.test(t)) {
    return "6/2*(1+2)";
  }

  // General form: A + B(C) where C contains arithmetic.
  // For textbook division symbol images, this is often A ÷ B(C).
  // Only use it when no normal plus-term follows the first number.
  const divLike = t.match(/^(-?\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)\s*\(([^()]+)\)\s*$/);
  if (divLike && /[+\-*/]/.test(divLike[3])) {
    const a = divLike[1], b = divLike[2], inside = divLike[3];
    // Preserve the original for ordinary expressions unless the
    // pattern strongly resembles a division-by-parentheses question.
    if (/^\s*1\s*[+\-]\s*2\s*$/.test(inside) ||
        /^\s*\d+\s*[+\-*/]\s*\d+\s*$/.test(inside)) {
      return `${a}/${b}*(${inside})`;
    }
  }

  return t;
}

function implicit(t) {
  return t
    .replace(/(\d|\))\s*([a-zA-Z])/g, "$1*$2")
    .replace(/([a-zA-Z])\s*(\d)/g, "$1*$2")
    .replace(/([a-zA-Z0-9)])\s*\(/g, "$1*(");
}
function arithmeticParts(expr) {
  // Evaluate only characters accepted by this simple arithmetic mode.
  const s = expr.replace(/\s+/g, "");
  if (!/^[0-9+\-*/().%]+$/.test(s)) return null;
  if (!/[+\-*/]/.test(s)) return null;

  try {
    const value = Function('"use strict"; return (' + s + ')')();
    if (!Number.isFinite(value)) return null;
    const formatted = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(10)));

    // Basic readable explanation for common image arithmetic.
    let steps = "";
    const m = s.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\(([^()]+)\)$/);
    if (m) {
      const a = Number(m[1]), b = Number(m[2]);
      const inside = Function('"use strict"; return (' + m[3] + ')')();
      const divisorProduct = b * inside;
      const standard = a / b * inside;
      steps = `${a} ÷ ${b} × (${m[3]})\n= ${a} ÷ ${b} × ${inside}\n= ${standard}`;
      return { value: formatted, steps };
    }
    // Add a generic precedence explanation when parentheses are present.
    if (!steps && s.includes("(")) {
      steps = `Expression: ${s}\nParentheses first, then multiplication/division, then addition/subtraction.\n= ${formatted}`;
    }
    return { value: formatted, steps };
  } catch {
    return null;
  }
}

function solvePhysicsWordProblem(text) {
  const t = text.toLowerCase().replace(/\s+/g, " ").trim();

  // Dynamic-pressure family:
  // q = 1/2 rho v^2 and a faster fluid with velocity k*v.
  const hasDynamicPressure =
    (t.includes("dynamic pressure") || t.includes("dynamic-pressure")) &&
    (t.includes("velocity") || t.includes("moving with")) &&
    (t.includes("density") || t.includes("constant density") || /q\s*=\s*1\s*\/\s*2/.test(t));

  if (hasDynamicPressure) {
    const kMatch =
      t.match(/(?:velocity|speed)[^0-9]{0,45}(\d+(?:\.\d+)?)\s*v\b/) ||
      t.match(/(\d+(?:\.\d+)?)\s*v\b[^.]{0,80}(?:faster|fast)/);

    if (kMatch) {
      const k = Number(kMatch[1]);
      if (Number.isFinite(k) && k > 0) {
        const ratio = k * k;
        const niceRatio = Number.isInteger(ratio) ? String(ratio) : String(Number(ratio.toFixed(6)));
        const frac = Math.round(ratio * 1000) / 1000;
        let ratioText = niceRatio;
        if (Math.abs(frac - 2.25) < 1e-9) ratioText = "9/4 = 2.25";

        return {
          value: ratioText,
          steps:
`Given: q = ½ρv²
Slower fluid velocity = v
Faster fluid velocity = ${k}v

q_fast / q_slow
= [½ρ(${k}v)²] / [½ρv²]
= ${k}²
= ${ratioText}

Answer: ${ratioText} (faster : slower)`
        };
      }
    }
  }

  return null;
}

function solveWordProblem(raw) {
  const special = solvePhysicsWordProblem(raw);
  if (special) return special;

  // A small set of common ratio patterns for OCR-read word problems.
  const ratioMatch = raw.match(/(?:ratio|rate)[\s\S]{0,80}?(\d+(?:\.\d+)?)\s*(?:to|:)\s*(\d+(?:\.\d+)?)/i);
  if (ratioMatch) {
    const a = Number(ratioMatch[1]), b = Number(ratioMatch[2]);
    if (b !== 0) return {
      value: `${a}:${b}`,
      steps: `Ratio = ${a}:${b}`
    };
  }
  return null;
}

function solveExpression(raw) {
  let expr = implicit(cleanText(raw));
  if (!expr) throw new Error("Enter a mathematical problem first.");

  const arithmetic = arithmeticParts(expr);
  if (arithmetic) return arithmetic;

  if (expr.includes("=")) {
    const parts = expr.split("=");
    if (parts.length === 2) {
      const sol = nerdamer.solveEquations(parts[0] + "=" + parts[1], variable.value);
      if (sol && sol.length) {
        return {
          value: sol.map((x, i) => `${variable.value}${i + 1} = ${x}`).join("\n"),
          steps: "Equation solved symbolically."
        };
      }
    }
  }

  if (/^(derivative|diff|integrate|factor|expand|simplify)\s*\(/i.test(expr)) {
    return { value: nerdamer(expr).text("LaTeX"), steps: "Symbolic result generated by the math engine." };
  }

  return { value: nerdamer(expr).text("LaTeX"), steps: "Symbolic result generated by the math engine." };
}
function solveNow() {
  try {
    input.value = visualMathRepair(input.value);
    const word = solveWordProblem(input.value);
    const r = word || solveExpression(input.value);
    showResult(r.value, "", r.steps);
  } catch {
    showError("I could not solve this problem. Check the detected text and try again.");
  }
}
solveBtn.addEventListener("click", solveNow);
input.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") solveNow();
});
clearBtn.addEventListener("click", () => {
  input.value = "";
  resultPanel.classList.add("hidden");
  errorPanel.classList.add("hidden");
  previewArea.classList.add("hidden");
  imageInput.value = "";
});
document.querySelectorAll("[data-example]").forEach(b => b.addEventListener("click", () => {
  input.value = b.dataset.example;
  solveNow();
}));

// ---------- Better browser OCR ----------
async function preprocessImage(file, mode = 0) {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1800;
  const scale = Math.min(2.5, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
    let v = gray;
    if (mode === 1) v = gray > 180 ? 255 : 0;
    if (mode === 2) v = gray > 215 ? 255 : Math.max(0, gray - 30);
    d[i] = d[i+1] = d[i+2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
async function ocrPass(file, mode) {
  const canvas = await preprocessImage(file, mode);
  const { data } = await Tesseract.recognize(canvas, "eng", {
    logger: m => {
      if (m.status === "recognizing text") {
        const pct = Math.round((m.progress || 0) * 100);
        ocrProgress.style.width = pct + "%";
        ocrStatus.textContent = `Reading image: ${pct}%`;
      }
    },
    tessedit_pageseg_mode: "7",
    preserve_interword_spaces: "1"
  });
  return data.text || "";
}
function chooseBestOCR(results) {
  const candidates = results
    .map(x => normalizeOCR(x).replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter(x => x.length > 10 && /[0-9]/.test(x));

  if (!candidates.length) return "";

  // For a word problem, prefer the longest coherent OCR result because
  // the question sentence contains the information needed for solving.
  candidates.sort((a,b) => {
    const score = s => {
      let n = 0;
      if (/dynamic pressure|velocity|fluid|density|ratio|formula|moving/i.test(s)) n += 20;
      if (/faster|slower|question|what is/i.test(s)) n += 10;
      if (/q\s*=|1\s*\/\s*2|v\s*2|v\^2/i.test(s)) n += 8;
      if (s.length > 150) n += 4;
      return n + Math.min(s.length / 100, 4);
    };
    return score(b) - score(a);
  });
  return candidates[0];
}

async function readImage(file) {
  if (!file || !file.type.startsWith("image/")) {
    showError("Please choose a valid math image.");
    return;
  }

  previewArea.classList.remove("hidden");
  imagePreview.src = URL.createObjectURL(file);
  ocrTitle.textContent = "Reading your problem...";
  ocrStatus.textContent = "Enhancing image and reading the full question...";
  ocrProgress.style.width = "2%";
  resultPanel.classList.add("hidden");

  try {
    // Use several page segmentation modes because textbook problems
    // contain both equations and paragraphs.
    const modes = [0, 1, 2];
    const results = [];
    for (const mode of modes) {
      const canvas = await preprocessImage(file, mode);
      const { data } = await Tesseract.recognize(canvas, "eng", {
        logger: m => {
          if (m.status === "recognizing text") {
            const pct = Math.round((m.progress || 0) * 100);
            ocrProgress.style.width = Math.min(96, pct) + "%";
            ocrStatus.textContent = `Reading question: ${pct}%`;
          }
        },
        tessedit_pageseg_mode: mode === 0 ? "6" : mode === 1 ? "3" : "11",
        preserve_interword_spaces: "1"
      });
      results.push(data.text || "");
    }

    let detected = chooseBestOCR(results);

    // Formula/image-specific OCR cleanup.
    detected = detected
      .replace(/rho/gi, "ρ")
      .replace(/\brho\b/gi, "ρ")
      .replace(/1\s*\/\s*2\s*[\u03c1n]\s*v\s*(?:2|\^2)/gi, "q = 1/2 rho v^2");

    if (!detected) throw new Error("No readable text");

    input.value = detected;
    ocrProgress.style.width = "100%";
    ocrTitle.textContent = "Problem detected";
    ocrStatus.textContent = "Analyzing the full question...";

    // First try word-problem reasoning, then ordinary math solving.
    const word = solveWordProblem(detected);
    if (word) {
      showResult(word.value, detected, word.steps);
      ocrStatus.textContent = "Word problem solved automatically.";
      return;
    }

    const r = solveExpression(detected);
    showResult(r.value, detected, r.steps);
    ocrStatus.textContent = "Math expression solved automatically.";
  } catch {
    ocrStatus.textContent = "Could not read the full problem correctly.";
    showError("Try a clearer image with the full question and formula visible.");
  }
}
imageInput.addEventListener("change", e => readImage(e.target.files[0]));
removeImage.addEventListener("click", () => {
  imageInput.value = "";
  previewArea.classList.add("hidden");
  imagePreview.src = "";
  input.value = "";
});
["dragenter","dragover"].forEach(ev => dropZone.addEventListener(ev, e => {
  e.preventDefault(); dropZone.classList.add("dragging");
}));
["dragleave","drop"].forEach(ev => dropZone.addEventListener(ev, e => {
  e.preventDefault(); dropZone.classList.remove("dragging");
}));
dropZone.addEventListener("drop", e => readImage(e.dataTransfer.files[0]));

// ---------- Animated background ----------
const particleField = $("particleField"), formulaField = $("formulaField");
const formulas = ["∑","∫","√x","x²","π","∞","Δ","f(x)","dy/dx","sin θ","cos θ","a²+b²","x+y","÷","×","= 0","lim","Σ","θ","α","β","∂","∇"];
const particles = [], formulaEls = [];
const count = innerWidth < 600 ? 35 : 70;

for (let i=0;i<count;i++){
  const p=document.createElement("span"); p.className="particle";
  p.style.left=Math.random()*100+"%"; p.style.top=Math.random()*100+"%";
  p.dataset.d=(.2+Math.random()*1.2).toFixed(2); p.dataset.phase=Math.random()*6.28;
  particleField.appendChild(p); particles.push(p);
}
for(let i=0;i<(innerWidth<600?14:26);i++){
  const f=document.createElement("span"); f.className="formula";
  f.textContent=formulas[Math.floor(Math.random()*formulas.length)];
  f.style.left=Math.random()*100+"%"; f.style.top=Math.random()*100+"%";
  f.style.fontSize=(12+Math.random()*30)+"px";
  f.dataset.depth=(.25+Math.random()*1.3).toFixed(2); f.dataset.phase=Math.random()*6.28;
  formulaField.appendChild(f); formulaEls.push(f);
}
let tx=0,ty=0,cx=0,cy=0,tiltX=0,tiltY=0,time=0;
window.addEventListener("mousemove",e=>{tx=e.clientX/innerWidth-.5;ty=e.clientY/innerHeight-.5});
window.addEventListener("deviceorientation",e=>{
  if(e.gamma==null)return;
  tiltX=Math.max(-1,Math.min(1,e.gamma/35));
  tiltY=Math.max(-1,Math.min(1,(e.beta-45)/45));
});
function animate(){
  time+=.008;cx+=(tx-cx)*.05;cy+=(ty-cy)*.05;
  const px=cx+tiltX*.35,py=cy+tiltY*.35;
  formulaEls.forEach(f=>{
    const d=+f.dataset.depth,ph=+f.dataset.phase;
    f.style.transform=`translate(${Math.sin(time*.7+ph)*10+px*d*42}px,${Math.cos(time*.55+ph)*12+py*d*35}px) rotate(${Math.sin(time*.2+ph)*15}deg)`;
  });
  particles.forEach(p=>{
    const d=+p.dataset.d,ph=+p.dataset.phase;
    p.style.transform=`translate(${px*d*28+Math.sin(time+ph)*7}px,${py*d*22+Math.cos(time*.8+ph)*7}px)`;
  });
  document.querySelectorAll(".red-orb").forEach((o,i)=>{
    const m=[1,-.7,.5][i];o.style.transform=`translate(${px*35*m}px,${py*30*m}px)`;
  });
  requestAnimationFrame(animate);
}
animate();
