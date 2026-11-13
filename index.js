const STORAGE_KEY = "pulseFitnessApp_v1";
const ACTIVE_USER_KEY = "pulseFitnessActiveUser";
const database = loadDatabase();
let currentEmail = sessionStorage.getItem(ACTIVE_USER_KEY);

// Backend handoff: Replace local account reads/writes with auth API calls.
// Login sends email/password and receives an authenticated user/session.
// Signup sends email, password, and profile fields; keep returned user data.
if (!currentEmail || !database.users[currentEmail]) {
  currentEmail = null;
  sessionStorage.removeItem(ACTIVE_USER_KEY);
}

// Loads account data from localStorage when this script starts.
function loadDatabase() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {users:{}};
  } catch {
    return {users:{}};
  }
}

// Saves the updated account data; called by createUserAccount.
function saveDatabase() {
  localStorage.setItem(STORAGE_KEY,JSON.stringify(database));
}

// Calculates calorie and macro targets from an account; called by createUserAccount.
function calculateRecommendedTargets(account) {
  const profile = account.profile;
  const weightKilograms = profile.weightKg || 70;
  const heightCentimeters = profile.heightCm || 170;
  const ageYears = profile.age || 25;
  const basalMetabolicRate = 10*weightKilograms + 6.25*heightCentimeters - 5*ageYears + 5;
  let calories = basalMetabolicRate * 1.45;
  if (profile.goal === "lose") calories -= 350;
  if (profile.goal === "build") calories += 250;
  calories = Math.max(1200,Math.round(calories/50)*50);
  const protein = Math.round(weightKilograms * (profile.goal === "build" ? 2 : 1.8));
  const fat = Math.round(calories * .27 / 9);
  const carbs = Math.max(0,Math.round((calories - protein*4 - fat*9)/4));
  return {
    calories:calories,
    protein:protein,
    carbs:carbs,
    fat:fat
  };
}

// Creates an account, calculates its targets, and saves it; calls calculateRecommendedTargets and saveDatabase.
function createUserAccount(emailAddress,password,signupProfile) {
  const account = {
    email:emailAddress,
    password:password,
    profile:{
      name:signupProfile.name,
      age:25,
      heightCm:170,
      weightKg:signupProfile.weightKg,
      goalWeightKg:signupProfile.goalWeightKg,
      goal:signupProfile.goal
    },
    targets:{},
    days:{},
    createdAt:new Date().toISOString()
  };
  account.targets = calculateRecommendedTargets(account);
  database.users[emailAddress] = account;
  saveDatabase();
}

// Saves the signed-in email in sessionStorage; called after login or signup.
function setActiveUserEmail(emailAddress) {
  sessionStorage.setItem(ACTIVE_USER_KEY,emailAddress);
}

// Shows a short message; calls getElementById and setTimeout to hide it later.
function toast(message) {
  const toastElement = document.getElementById("toast");
  if (!toastElement) return;
  toastElement.textContent = message;
  toastElement.classList.remove("translate-y-5","opacity-0");
  toastElement.classList.add("translate-y-0","opacity-100");
  clearTimeout(toast.timer);
  // Hides the message after a delay by changing the toast's classes.
  toast.timer = setTimeout(function() {
    toastElement.classList.add("translate-y-5","opacity-0");
    toastElement.classList.remove("translate-y-0","opacity-100");
  },2200);
}

const pendingToast = sessionStorage.getItem("pulseToast");
if (pendingToast) {
  sessionStorage.removeItem("pulseToast");
  toast(pendingToast);
}

// Checks the session and sets up the login, signup, and onboarding handlers.
// Its handlers call setAuthMode, setActiveUserEmail, and createUserAccount.
function initAuthPage() {
  if (currentEmail) {
    window.location.replace("dashboard.html");
    return;
  }

  const loginTab = document.getElementById("loginTab");
  const signupTab = document.getElementById("signupTab");
  const authTitle = document.getElementById("authTitle");
  const authSubtitle = document.getElementById("authSubtitle");
  const authSubmit = document.getElementById("authSubmit");
  const authPasswordInput = document.getElementById("authPassword");
  const authEmailInput = document.getElementById("authEmail");
  const authError = document.getElementById("authError");
  const authForm = document.getElementById("authForm");
  const authFormSection = document.getElementById("authFormSection");
  const onboardingSection = document.getElementById("onboardingSection");
  const onboardingForm = document.getElementById("onboardingForm");
  let authMode = "login";
  let pendingSignup;

  // Updates the selected tab and form text; called by the login and signup tab handlers.
  function setAuthMode(mode) {
    authMode = mode;
    const isLogin = mode === "login";
    loginTab.classList.toggle("bg-slate-800",isLogin);
    loginTab.classList.toggle("font-bold",isLogin);
    loginTab.classList.toggle("text-slate-100",isLogin);
    loginTab.classList.toggle("text-slate-400",!isLogin);
    signupTab.classList.toggle("bg-slate-800",!isLogin);
    signupTab.classList.toggle("font-bold",!isLogin);
    signupTab.classList.toggle("text-slate-100",!isLogin);
    signupTab.classList.toggle("text-slate-400",isLogin);
    authTitle.textContent = isLogin ? "Welcome back." : "Start your journey.";
    authSubtitle.textContent = isLogin ? "Log in to keep your progress moving." : "Create an account to track your fitness goals.";
    authSubmit.textContent = isLogin ? "Log In" : "Continue";
    authPasswordInput.autocomplete = isLogin ? "current-password" : "new-password";
    authError.textContent = "";
  }

  // Selects the login tab by calling setAuthMode.
  loginTab.addEventListener("click",function() {
    setAuthMode("login");
  });
  // Selects the signup tab by calling setAuthMode.
  signupTab.addEventListener("click",function() {
    setAuthMode("signup");
  });

  // Checks login details or starts signup; calls setActiveUserEmail after a successful login.
  // Backend handoff: Send these form values to the login or signup endpoint;
  // use its response/error instead of checking or creating accounts in the database.
  authForm.addEventListener("submit",function(event) {
    event.preventDefault();
    const emailAddress = authEmailInput.value.trim().toLowerCase();
    const password = authPasswordInput.value;

    if (authMode === "login") {
      const existingAccount = database.users[emailAddress];
      if (!existingAccount || existingAccount.password !== password) {
        authError.textContent = "Email or password is incorrect.";
        return;
      }
      setActiveUserEmail(emailAddress);
      window.location.href = "dashboard.html";
      return;
    }

    if (database.users[emailAddress]) {
      authError.textContent = "An account with this email already exists.";
      return;
    }
    if (password.length < 4) {
      authError.textContent = "Use at least 4 characters for the password.";
      return;
    }
    pendingSignup = {
      emailAddress:emailAddress,
      password:password
    };
    authFormSection.classList.add("hidden");
    onboardingSection.classList.remove("hidden");
  });

  // Creates an account from onboarding values and opens the dashboard.
  // Calls createUserAccount and setActiveUserEmail.
  // Backend handoff: Send these onboarding fields with the signup request.
  onboardingForm.addEventListener("submit",function(event) {
    event.preventDefault();
    const weightKilograms = Number(document.getElementById("onWeight").value);
    const goalWeightKilograms = Number(document.getElementById("onGoalWeight").value);
    if (weightKilograms <= 0 || goalWeightKilograms <= 0) return;
    createUserAccount(pendingSignup.emailAddress,pendingSignup.password,{
      name:document.getElementById("onName").value.trim(),
      weightKg:weightKilograms,
      goalWeightKg:goalWeightKilograms,
      goal:document.getElementById("onGoal").value
    });
    setActiveUserEmail(pendingSignup.emailAddress);
    window.location.href = "dashboard.html";
  });
}

initAuthPage();
