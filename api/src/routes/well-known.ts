import type { FastifyInstance } from 'fastify';
import { getConfig } from '../config.js';

/**
 * Public association files required by platform passkey / Digital Asset Links.
 * Served from the API host so WEBAUTHN_RP_ID can point at the same origin
 * (e.g. api.example.com) without a separate static site.
 */
export async function wellKnownRoutes(app: FastifyInstance) {
  app.get('/.well-known/assetlinks.json', async (_req, reply) => {
    const cfg = getConfig();
    const fingerprints = cfg.android.sha256CertFingerprints;
    if (fingerprints.length === 0) {
      return reply.status(404).type('application/json').send({
        error: 'ANDROID_SHA256_CERT_FINGERPRINTS is not configured',
      });
    }
    // Google Password Manager validates RP ID via Digital Asset Links at create
    // time. Passkey docs require BOTH relations (handle_all_urls + get_login_creds).
    // Serve as plain public JSON with minimal headers so GMS fetchers don't reject.
    return reply
      .type('application/json')
      .header('cache-control', 'no-store')
      .header('cross-origin-resource-policy', 'cross-origin')
      .header('cross-origin-opener-policy', 'unsafe-none')
      .removeHeader('content-security-policy')
      .send([
        {
          relation: [
            'delegate_permission/common.handle_all_urls',
            'delegate_permission/common.get_login_creds',
          ],
          target: {
            namespace: 'android_app',
            package_name: cfg.android.packageName,
            sha256_cert_fingerprints: fingerprints,
          },
        },
      ]);
  });

  // Optional AASA stub when Apple Team ID is configured. Full webcredentials
  // association still requires the RP domain to match entitlements.
  app.get('/.well-known/apple-app-site-association', async (_req, reply) => {
    const cfg = getConfig();
    const teamId = cfg.oauth.appleTeamId;
    if (!teamId || teamId === 'TESTTEAM') {
      return reply.status(404).type('application/json').send({ error: 'not configured' });
    }
    return reply
      .type('application/json')
      .header('cache-control', 'public, max-age=300')
      .send({
        applinks: { apps: [], details: [] },
        webcredentials: {
          apps: [`${teamId}.${cfg.android.packageName}`],
        },
      });
  });
}
