(() => {
  "use strict";

  const STORAGE_KEY = "pulseFitnessApp_v1";
  const ACTIVE_USER_KEY = "pulseFitnessActiveUser";
  const db = loadDB();
  const currentEmail = sessionStorage.getItem(ACTIVE_USER_KEY);

  // Backend handoff: Load the signed-in user's profile, targets, and food log
  // from the API; submit new food entries and deletions back to the API.
  if (!currentEmail || !db.users[currentEmail]) {
    sessionStorage.removeItem(ACTIVE_USER_KEY);
    window.location.replace("index.html");
    return;
  }

  // Reads and writes account and food-log data in browser storage.
  // Backend handoff: Replace loadDB/saveDB with API reads and writes.
  function loadDB() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {users:{}};
    } catch {
      return {users:{}};
    }
  }

  function saveDB() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  function user() {
    return db.users[currentEmail];
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  // Returns today's food log and creates an empty one if needed.
  function ensureDay(u) {
    const key = todayKey();
    if (!u.days[key]) u.days[key] = {foods:[]};
    return u.days[key];
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  }

  // Shows a message briefly after an action succeeds.
  function toast(message) {
    const toastElement = document.getElementById("toast");
    if (!toastElement) return;
    toastElement.textContent = message;
    toastElement.classList.remove("translate-y-5","opacity-0");
    toastElement.classList.add("translate-y-0","opacity-100");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
      toastElement.classList.add("translate-y-5","opacity-0");
      toastElement.classList.remove("translate-y-0","opacity-100");
    },2200);
  }

  const pendingToast = sessionStorage.getItem("pulseToast");
  if (pendingToast) {
    sessionStorage.removeItem("pulseToast");
    toast(pendingToast);
  }

  // Shows the user's name; clicking Log Out clears the session and opens login.
  function initNavigation() {
    document.getElementById("navUser").textContent = user().profile.name;
    document.getElementById("logoutBtn").addEventListener("click",() => {
      sessionStorage.removeItem(ACTIVE_USER_KEY);
      window.location.href = "index.html";
    });
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString(undefined,{maximumFractionDigits:1});
  }

  // Adds today's food values and updates each nutrition total and progress bar.
  function renderMetrics() {
    const u = user(), day = ensureDay(u), foods = day.foods;
    const totals = foods.reduce((total,food) => ({
      calories:total.calories + food.calories,
      protein:total.protein + food.protein,
      carbs:total.carbs + food.carbs,
      fat:total.fat + food.fat
    }),{calories:0,protein:0,carbs:0,fat:0});
    const metrics = [
      ["cal",totals.calories,u.targets.calories,"kcal"],
      ["protein",totals.protein,u.targets.protein,"g"],
      ["carbs",totals.carbs,u.targets.carbs,"g"],
      ["fat",totals.fat,u.targets.fat,"g"]
    ];
    metrics.forEach(([key,val,target,unit]) => {
      document.getElementById(key + "Value").textContent = fmt(val) + (unit === "kcal" ? "" : " " + unit);
      document.getElementById(key + "Target").textContent = `of ${fmt(target)} ${unit}`;
      document.getElementById(key + "Bar").style.width = Math.min(100, target > 0 ? val / target * 100 : 0) + "%";
    });
    document.getElementById("todayLabel").textContent = new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});
  }

  // Displays today's foods; each Delete click removes that food and refreshes totals.
  function renderFood() {
    const list = document.getElementById("foodList"), foods = ensureDay(user()).foods;
    list.innerHTML = "";
    if (!foods.length) {
      list.innerHTML = '<div class="mt-4 rounded-lg border border-dashed border-slate-700 bg-slate-950 px-3 py-6 text-center text-sm text-slate-400">No food logged yet. Add your first meal above.</div>';
      return;
    }
    foods.slice().reverse().forEach(f => {
      const el = document.createElement("div");
      el.className = "flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-3";
      const main = document.createElement("div");
      main.className = "min-w-0";
      const title = document.createElement("div");
      title.className = "break-words font-bold";
      title.textContent = f.name;
      const sub = document.createElement("div");
      sub.className = "mt-0.5 text-xs text-slate-400";
      sub.textContent = `P ${fmt(f.protein)}g · C ${fmt(f.carbs)}g · F ${fmt(f.fat)}g`;
      main.append(title,sub);
      const actions = document.createElement("div");
      actions.className = "flex shrink-0 items-center gap-2.5";
      const cal = document.createElement("span");
      cal.className = "whitespace-nowrap text-sm text-slate-300";
      cal.textContent = `${fmt(f.calories)} kcal`;
      const del = document.createElement("button");
      del.className = "rounded-[7px] px-[7px] py-1 text-lg text-rose-400 hover:bg-rose-950";
      del.type = "button";
      del.textContent = "×";
      del.title = "Delete food";
      del.addEventListener("click",() => {
        // Backend handoff: Send this entry's id to the food delete endpoint.
        const d = ensureDay(user());
        d.foods = d.foods.filter(x => x.id !== f.id);
        saveDB();
        renderAll();
        toast("Food entry deleted");
      });
      actions.append(cal,del);
      el.append(main,actions);
      list.append(el);
    });
  }

  // Submitting the food form saves an entry, resets the form, and refreshes totals.
  // Backend handoff: Send the form's name and nutrition values to the food
  // create endpoint; use the saved entry returned by the API.
  function initFoodLogger() {
    document.getElementById("foodForm").addEventListener("submit", e => {
      e.preventDefault();
      const d = ensureDay(user());
      d.foods.push({
        id:uid(),
        name:document.getElementById("foodName").value.trim(),
        calories:Number(document.getElementById("foodCalories").value),
        protein:Number(document.getElementById("foodProtein").value),
        carbs:Number(document.getElementById("foodCarbs").value),
        fat:Number(document.getElementById("foodFat").value)
      });
      saveDB();
      e.target.reset();
      document.getElementById("foodProtein").value = document.getElementById("foodCarbs").value = document.getElementById("foodFat").value = 0;
      renderAll();
      toast("Food added to today's log");
    });
  }

  // Refreshes the user's name, nutrition totals, and food list.
  function renderAll() {
    const u = user();
    document.getElementById("navUser").textContent = u.profile.name;
    renderMetrics();
    renderFood();
  }

  initNavigation();
  initFoodLogger();
  renderAll();
})();
