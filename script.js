(() => {
  "use strict";

  const mainEl = document.getElementById("main");
  const previewEl = document.getElementById("preview");
  const OPS = ["+", "−", "×", "÷"];

  let expr = "";            // what the user has typed, e.g. "12+3×4"
  let justEvaluated = false;
  let error = false;

  // ---------- Evaluation (no eval) ----------
  // Returns a number, or null if the expression is incomplete.
  function evaluate(str) {
    const tokens = str.match(/\d+\.?\d*|\.\d+|[+−×÷]/g);
    if (!tokens) return null;

    // Turn unary minus into part of the number: "5×−2" -> 5, ×, -2
    const parts = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const prevIsOp = parts.length === 0 || OPS.includes(parts[parts.length - 1]);
      if (t === "−" && prevIsOp) {
        const next = tokens[++i];
        if (next === undefined || OPS.includes(next)) return null;
        parts.push(-parseFloat(next));
      } else if (OPS.includes(t)) {
        parts.push(t);
      } else {
        parts.push(parseFloat(t));
      }
    }

    // Must alternate number, op, number ... and end on a number
    if (parts.length % 2 === 0) return null;
    for (let i = 0; i < parts.length; i++) {
      if ((i % 2 === 0) !== (typeof parts[i] === "number")) return null;
    }

    // Pass 1: × and ÷ (higher precedence)
    const pass = [parts[0]];
    for (let i = 1; i < parts.length; i += 2) {
      const op = parts[i], n = parts[i + 1];
      if (op === "×") pass.push(pass.pop() * n);
      else if (op === "÷") {
        if (n === 0) return Infinity;           // flag division by zero
        pass.push(pass.pop() / n);
      } else pass.push(op, n);
    }

    // Pass 2: + and −
    let result = pass[0];
    for (let i = 1; i < pass.length; i += 2) {
      result = pass[i] === "+" ? result + pass[i + 1] : result - pass[i + 1];
    }
    return result;
  }

  // Clean up floating-point noise (0.1 + 0.2 -> 0.3)
  function format(n) {
    const rounded = Number(n.toPrecision(12));
    return String(rounded).replace("-", "−");
  }

  // ---------- Helpers ----------
  const lastNumber = () => (expr.match(/\d*\.?\d*$/) || [""])[0];
  const lastChar = () => expr.slice(-1);
  const endsWithOp = () => OPS.includes(lastChar());

  function startFresh() {
    if (error || justEvaluated) {
      expr = "";
      error = false;
      justEvaluated = false;
      previewEl.textContent = "";
    }
  }

  // ---------- Actions ----------
  function inputDigit(d) {
    startFresh();
    if (lastNumber() === "0") expr = expr.slice(0, -1);   // no leading zeros
    expr += d;
    update();
  }

  function inputDecimal() {
    startFresh();
    const n = lastNumber();
    if (n.includes(".")) return;
    expr += n === "" ? "0." : ".";
    update();
  }

  function inputOperator(op) {
    if (error) return;
    if (justEvaluated) { justEvaluated = false; previewEl.textContent = ""; }  // keep going from the result

    if (expr === "") {
      if (op === "−") { expr = "−"; update(); }            // allow a leading negative
      return;
    }
    if (expr === "−") return;

    if (endsWithOp()) {
      const prev = expr.slice(-2, -1);
      if (op === "−" && (lastChar() === "×" || lastChar() === "÷")) {
        expr += "−";                                        // e.g. 5×−2
      } else {
        expr = expr.slice(0, -1);                           // replace the operator
        if (OPS.includes(expr.slice(-1))) expr = expr.slice(0, -1);
        expr += op;
      }
    } else {
      expr += op;
    }
    update();
  }

  function backspace() {
    if (error || justEvaluated) { clearAll(); return; }
    expr = expr.slice(0, -1);
    update();
  }

  function clearAll() {
    expr = "";
    error = false;
    justEvaluated = false;
    previewEl.textContent = "";
    update();
  }

  function percent() {
    if (error || expr === "" || endsWithOp()) return;
    justEvaluated = false;
    const n = lastNumber();
    if (n === "") return;
    expr = expr.slice(0, expr.length - n.length) + format(parseFloat(n) / 100);
    update();
  }

  function equals() {
    if (error || expr === "" || justEvaluated) return;
    const result = evaluate(expr);
    if (result === null) return;                            // incomplete expression

    if (!isFinite(result)) {
      error = true;
      previewEl.textContent = expr + " =";
      render("Can't divide by zero", true);
      return;
    }
    previewEl.textContent = expr + " =";
    expr = format(result);
    justEvaluated = true;
    render(expr);
  }

  // ---------- Rendering ----------
  function render(text, isError = false) {
    mainEl.textContent = text;
    mainEl.classList.toggle("error", isError);
    mainEl.classList.toggle("md", !isError && text.length > 9 && text.length <= 14);
    mainEl.classList.toggle("sm", !isError && text.length > 14);
  }

  // Real-time result: show a live answer while typing
  function update() {
    render(expr === "" ? "0" : expr);

    if (!justEvaluated && /[+−×÷]/.test(expr.replace(/^−/, ""))) {
      const live = evaluate(endsWithOp() ? expr.slice(0, -1) : expr);
      previewEl.textContent = live !== null && isFinite(live) ? "= " + format(live) : "";
    } else if (!justEvaluated) {
      previewEl.textContent = "";
    }

    // Highlight the operator currently waiting for a number
    document.querySelectorAll(".key.op").forEach(k =>
      k.classList.toggle("is-active", endsWithOp() && k.dataset.op === lastChar()));
  }

  // ---------- Mouse / touch ----------
  document.querySelector(".keys").addEventListener("click", e => {
    const btn = e.target.closest(".key");
    if (!btn) return;
    press(btn);
  });

  function press(btn) {
    if (btn.dataset.digit !== undefined) inputDigit(btn.dataset.digit);
    else if (btn.dataset.op) inputOperator(btn.dataset.op);
    else {
      ({ clear: clearAll, backspace, percent, decimal: inputDecimal, equals })[btn.dataset.action]();
    }
  }

  // ---------- Keyboard ----------
  const keyMap = new Map();
  document.querySelectorAll(".key").forEach(btn =>
    btn.dataset.keys.split(",").forEach(k => keyMap.set(k, btn)));
  keyMap.set(",", keyMap.get("."));                        // comma works as a decimal point too

  document.addEventListener("keydown", e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;       // leave browser shortcuts alone
    const btn = keyMap.get(e.key);
    if (!btn) return;
    e.preventDefault();                                    // stops "/" quick-find and Enter re-clicking a focused key
    press(btn);
    btn.classList.add("is-pressed");
    setTimeout(() => btn.classList.remove("is-pressed"), 120);
  });

  update();
})();
