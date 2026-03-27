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
 * Attempt SSO token acquisition via Office.js.
 * Falls back to dialog-based login if SSO is unavailable.
 */
export async function ensureAuthenticated(): Promise<string> {
  const existing = getToken();
  if (existing) return existing;

  try {
    const ssoToken = await trySSOLogin();
    configure({ token: ssoToken });
    return ssoToken;
  } catch {
    return dialogLogin();
  }
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
