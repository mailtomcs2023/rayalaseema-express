import { google, searchconsole_v1 } from "googleapis";
import { JWT } from "google-auth-library";
import { readFileSync } from "node:fs";

import { Config, scopesFor } from "./config.js";

export type SearchConsole = searchconsole_v1.Searchconsole;

/**
 * Builds an authenticated Search Console client from the service-account key.
 *
 * We read and parse the key ourselves rather than handing the path to
 * GoogleAuth so a malformed or wrong-type key fails at startup with a clear
 * message, instead of surfacing as an opaque 401 on the first tool call.
 */
export function createClient(config: Config): SearchConsole {
  let key: { client_email?: string; private_key?: string; type?: string };
  try {
    key = JSON.parse(readFileSync(config.keyFile, "utf8"));
  } catch (err) {
    throw new Error(`Could not parse GSC_KEY_FILE as JSON: ${(err as Error).message}`);
  }

  if (key.type !== "service_account" || !key.client_email || !key.private_key) {
    throw new Error(
      `GSC_KEY_FILE is not a service-account key (expected type "service_account" with client_email and private_key).`,
    );
  }

  const auth = new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: scopesFor(config),
  });

  return google.searchconsole({ version: "v1", auth });
}
