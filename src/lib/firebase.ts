import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

// 1. Ambil string JSON dari Env, jika kosong default ke objek kosong string '{}'
const configEnv = import.meta.env.VITE_FIREBASE_CONFIG || "{}";

// 2. Parse string tersebut menjadi objek agar bisa dipakai oleh initializeApp
const firebaseConfig = JSON.parse(configEnv);

// 3. Jalankan inisialisasi seperti biasa
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // jika Anda mendefinisikan auth di bawahnya

export {
  auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  User,
};

export const provider = new GoogleAuthProvider();
// Request Google Sheets and Drive file scopes
provider.addScope("https://www.googleapis.com/auth/spreadsheets");
provider.addScope("https://www.googleapis.com/auth/drive.file");

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void,
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // In a real OAuth session, the access token should be retrieved,
      // but since Firebase onAuthStateChanged doesn't contain the oauth token,
      // we can try to retrieve it if cached or ask the user to sign in if needed.
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = localStorage.getItem("g_access_token"); // fall back to localStorage for seamless refreshing in developer previews
        if (cachedAccessToken) {
          if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
        } else {
          if (onAuthFailure) onAuthFailure();
        }
      }
    } else {
      cachedAccessToken = null;
      localStorage.removeItem("g_access_token");
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Check if page loaded from a redirect login
export const checkRedirectResult = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        localStorage.setItem("g_access_token", cachedAccessToken);
        return { user: result.user, accessToken: cachedAccessToken };
      }
    }
  } catch (error) {
    console.error("getRedirectResult error:", error);
  }
  return null;
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to get access token from Google Auth");
    }

    cachedAccessToken = credential.accessToken;
    // Persist temporarily to handle refresh during dev / previews gracefully
    localStorage.setItem("g_access_token", cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.warn("Sign in with popup failed, trying redirect fallback:", error);
    if (
      error.code === "auth/popup-closed-by-user" ||
      error.code === "auth/popup-blocked" ||
      error.code === "auth/cancelled-popup-request" ||
      error.message?.includes("popup")
    ) {
      try {
        await signInWithRedirect(auth, provider);
        return null;
      } catch (redirectError: any) {
        console.error("Sign in with redirect failed:", redirectError);
        throw redirectError;
      }
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken) {
    cachedAccessToken = localStorage.getItem("g_access_token");
  }
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem("g_access_token");
};
