/**
 * Shared authentication helper for Merris Office Add-ins.
 * Handles MSAL-based SSO via Office.js dialog API.
 */

import { configure, getToken, clearToken } from "./api-client";

/* globals Office */
declare const Office: any;

const CLIENT_ID = "00000000-0000-0000-0000-000000000000"; // Replace with real AAD app ID
const AUTHORITY = "https://login.microsoftonline.com/common";
const REDIRECT_URI = "https://localhost:3000/auth/callback";
const SCOPES = ["openid", "profile", "email"];

let _dialogLoginPromise: Promise<string> | null = null;

/**
 * Attempt to authenticate. Tries:
 * 1. Existing token in localStorage
 * 2. Merris API login (email/password from localStorage or defaults for dev)
 * 3. Office SSO (requires Azure AD — production only)
 */
export async function ensureAuthenticated(): Promise<string> {
  const existing = getToken();
  if (existing) return existing;

  // Dev/testing: auto-login with Merris API credentials
  try {
    const token = await merrisApiLogin();
    if (token) return token;
  } catch {
    // Fall through
  }

  try {
    const ssoToken = await trySSOLogin();
    configure({ token: ssoToken });
    return ssoToken;
  } catch {
    return dialogLogin();
  }
}

/**
 * Login directly with Merris API (email/password).
 * Uses stored credentials or dev defaults.
 */
async function merrisApiLogin(): Promise<string | null> {
  const baseUrl = "/api/v1";
  const email = localStorage.getItem("merris_email") || "tim@merris.ai";
  const password = localStorage.getItem("merris_password") || "Test1234!";

  const response = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (data.token) {
    configure({ token: data.token });
    return data.token;
  }
  return null;
}

async function trySSOLogin(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (typeof Office === "undefined" || !Office.context?.auth) {
      reject(new Error("Office.js not available"));
      return;
    }
    Office.context.auth.getAccessTokenAsync(
      { allowSignInPrompt: true, forMSGraphAccess: true },
      (result: any) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          resolve(result.value);
        } else {
          reject(new Error(result.error?.message || "SSO failed"));
        }
      }
    );
  });
}

function dialogLogin(): Promise<string> {
  if (_dialogLoginPromise) return _dialogLoginPromise;

  _dialogLoginPromise = new Promise<string>((resolve, reject) => {
    const loginUrl =
      `${AUTHORITY}/oauth2/v2.0/authorize?` +
      `client_id=${CLIENT_ID}` +
      `&response_type=token` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=${encodeURIComponent(SCOPES.join(" "))}`;

    Office.context.ui.displayDialogAsync(
      loginUrl,
      { height: 60, width: 40 },
      (asyncResult: any) => {
        if (asyncResult.status === Office.AsyncResultStatus.Failed) {
          _dialogLoginPromise = null;
          reject(new Error("Dialog failed to open"));
          return;
        }

        const dialog = asyncResult.value;

        dialog.addEventHandler(
          Office.EventType.DialogMessageReceived,
          (arg: any) => {
            dialog.close();
            _dialogLoginPromise = null;
            try {
              const message = JSON.parse(arg.message);
              if (message.token) {
                configure({ token: message.token });
                resolve(message.token);
              } else {
                reject(new Error("No token in dialog message"));
              }
            } catch {
              reject(new Error("Invalid dialog message"));
            }
          }
        );

        dialog.addEventHandler(
          Office.EventType.DialogEventReceived,
          () => {
            _dialogLoginPromise = null;
            reject(new Error("Dialog closed by user"));
          }
        );
      }
    );
  });

  return _dialogLoginPromise;
}

export function signOut(): void {
  clearToken();
}

export { getToken, configure };
