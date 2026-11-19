// Apple's push service, for the Live Activity on the phone (capture-lab.md › Live Activity;
// ADR 0013). Token-based auth: an ES256 JWT signed with the .p8 key from the Apple Developer
// account, sent over HTTP/2. Only Lab and TU Capture use this; Ton Up sends nothing anywhere.
import crypto from 'node:crypto';
import fs from 'node:fs';
import http2 from 'node:http2';

export interface ApnsConfig {
  keyFile: string;
  keyId: string;
  teamId: string;
  /** The app's bundle ID; Live Activity pushes go to `<bundle>.push-type.liveactivity`. */
  bundleId: string;
  /** Builds installed from Xcode use the sandbox; TestFlight and the App Store, production. */
  sandbox: boolean;
}

/** From lab/.env.local (Lab's README); null when push isn't set up. */
export function apnsConfig(
  env: Record<string, string | undefined> = process.env,
): ApnsConfig | null {
  const keyFile = env.TONUP_APNS_KEY;
  const keyId = env.TONUP_APNS_KEY_ID;
  const teamId = env.TONUP_APNS_TEAM_ID;
  if (!keyFile || !keyId || !teamId) return null;
  return {
    keyFile,
    keyId,
    teamId,
    bundleId: env.TONUP_APNS_BUNDLE ?? 'com.perchedchicken.tonup.capture',
    sandbox: env.TONUP_APNS_ENV !== 'production',
  };
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/** The provider token: a JWT Apple accepts for up to an hour; refreshed after 50 minutes. */
export function providerToken(c: ApnsConfig, now = Date.now(), key?: string): string {
  const iat = Math.floor(now / 1000);
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: c.keyId }));
  const claims = b64url(JSON.stringify({ iss: c.teamId, iat }));
  const pem = key ?? fs.readFileSync(c.keyFile, 'utf8');
  const signature = crypto.sign('sha256', Buffer.from(`${header}.${claims}`), {
    key: pem,
    dsaEncoding: 'ieee-p1363',
  });
  return `${header}.${claims}.${b64url(signature)}`;
}

let cached: { token: string; at: number; keyId: string } | null = null;
function bearer(c: ApnsConfig): string {
  const now = Date.now();
  if (!cached || cached.keyId !== c.keyId || now - cached.at > 50 * 60_000) {
    cached = { token: providerToken(c, now), at: now, keyId: c.keyId };
  }
  return cached.token;
}

export interface ApnsResult {
  status: number;
  /** Apple's reason on failure (`BadDeviceToken`, `ExpiredToken`, …). */
  reason?: string;
}

/** A token Apple will never accept again: drop it. */
export const isDeadToken = (r: ApnsResult) =>
  r.status === 410 || r.reason === 'BadDeviceToken' || r.reason === 'ExpiredToken';

export type ApnsSender = (
  token: string,
  payload: object,
  options: { priority: 5 | 10; expiresAt?: number },
) => Promise<ApnsResult>;

const g = globalThis as unknown as { labApns?: http2.ClientHttp2Session };

/** Sends one Live Activity push. Resolves with Apple's answer; network errors are status 0. */
export function apnsSender(c: ApnsConfig): ApnsSender {
  const origin = c.sandbox ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
  const session = () => {
    if (!g.labApns || g.labApns.closed || g.labApns.destroyed) {
      g.labApns = http2.connect(origin);
      g.labApns.on('error', () => {
        g.labApns = undefined;
      });
      // Let Lab exit while the connection is idle.
      g.labApns.unref();
    }
    return g.labApns;
  };
  return (token, payload, { priority, expiresAt }) =>
    new Promise((resolve) => {
      let req: http2.ClientHttp2Stream;
      try {
        req = session().request({
          ':method': 'POST',
          ':path': `/3/device/${token}`,
          authorization: `bearer ${bearer(c)}`,
          'apns-topic': `${c.bundleId}.push-type.liveactivity`,
          'apns-push-type': 'liveactivity',
          'apns-priority': String(priority),
          ...(expiresAt ? { 'apns-expiration': String(Math.floor(expiresAt / 1000)) } : {}),
          'content-type': 'application/json',
        });
      } catch (e) {
        resolve({ status: 0, reason: e instanceof Error ? e.message : String(e) });
        return;
      }
      let status = 0;
      let body = '';
      req.setEncoding('utf8');
      req.setTimeout(15_000, () => req.close(http2.constants.NGHTTP2_CANCEL));
      req.on('response', (h) => {
        status = Number(h[':status'] ?? 0);
      });
      req.on('data', (chunk: string) => {
        body += chunk;
      });
      req.on('error', (e) => resolve({ status: 0, reason: e.message }));
      req.on('close', () => {
        let reason: string | undefined;
        try {
          reason = body ? (JSON.parse(body) as { reason?: string }).reason : undefined;
        } catch {
          reason = body || undefined;
        }
        resolve(status === 200 ? { status } : { status, reason: reason ?? 'No answer' });
      });
      req.end(JSON.stringify(payload));
    });
}
