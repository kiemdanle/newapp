import type { FastifyInstance } from 'fastify';
import { giveawayListQuerySchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { toApiGiveaway } from '../../services/giveaways/repository.js';
import { detectCountryFromIp } from '../../services/country/detect.js';
import { calculateHaversineDistanceKm, computeBoundingBox } from '../../services/geo/distance.js';
import { getCachedGiveawayDistanceSettings } from '../../services/admin/settings.js';
export async function listGiveawaysRoute(app: FastifyInstance) {
  app.get('/giveaways', async (req) => {
    const query = giveawayListQuerySchema.parse(req.query);
    const prisma = getPrisma();
    const viewerId = req.user?.id ?? null;

    let viewerCountry: string | null = null;
    let viewerLat: number | null = query.latitude ?? null;
    let viewerLng: number | null = query.longitude ?? null;

    if (viewerId) {
      const viewer = await prisma.user.findUnique({
        where: { id: viewerId },
        select: { country: true, latitude: true, longitude: true },
      });
      viewerCountry = viewer?.country ?? null;
      if (viewerLat === null && viewer?.latitude != null) viewerLat = viewer.latitude;
      if (viewerLng === null && viewer?.longitude != null) viewerLng = viewer.longitude;
    }
    if (!viewerCountry) {
      viewerCountry = await detectCountryFromIp(req.ip).catch(() => null);
    }

    const distanceSettings = await getCachedGiveawayDistanceSettings();
    const effectiveRadiusKm =
      distanceSettings.allowUserRadiusOverride && query.radiusKm
        ? query.radiusKm
        : distanceSettings.defaultRadiusKm;
    const whereConditions: Array<Record<string, unknown>> = [];

    if (query.status !== 'all') {
      whereConditions.push({ status: query.status });
    }

    if (query.q) {
      whereConditions.push({
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
          { locationText: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }

    if (query.location) {
      whereConditions.push({
        locationText: { contains: query.location, mode: 'insensitive' },
      });
    }

    if (query.hasPhoto === true) {
      whereConditions.push({ photoUrl: { not: null } });
    }

    if (query.country) {
      const c = query.country.toUpperCase();
      if (c === 'ALL') {
        // Global scope: no country condition
      } else if (c === 'LOCAL') {
        if (viewerCountry) {
          whereConditions.push({ country: viewerCountry });
        }
      } else {
        whereConditions.push({ country: c });
      }
    } else if (viewerCountry !== null) {
      whereConditions.push({
        OR: [{ country: viewerCountry }, { country: null }],
      });
    }


    if (viewerLat !== null && viewerLng !== null) {
      const bounds = computeBoundingBox(viewerLat, viewerLng, effectiveRadiusKm);
      whereConditions.push({
        latitude: { gte: bounds.minLat, lte: bounds.maxLat },
        longitude: { gte: bounds.minLon, lte: bounds.maxLon },
      });
    }
    let orderBy: Array<Record<string, unknown>> = [{ createdAt: 'desc' }];
    switch (query.sort) {
      case 'old':
        orderBy = [{ createdAt: 'asc' }];
        break;
      case 'claims_desc':
        orderBy = [{ claims: { _count: 'desc' } }, { createdAt: 'desc' }];
        break;
      case 'claims_asc':
        orderBy = [{ claims: { _count: 'asc' } }, { createdAt: 'desc' }];
        break;
      case 'expiry_asc':
        orderBy = [{ claimExpiresAt: 'asc' }, { createdAt: 'desc' }];
        break;
      case 'new':
      default:
        orderBy = [{ createdAt: 'desc' }];
        break;
    }

    const cursor = query.cursor ? { id: query.cursor } : undefined;
    let items = await prisma.giveaway.findMany({
      where: whereConditions.length > 0 ? { AND: whereConditions } : {},
      orderBy: orderBy as never,
      take: query.limit + 1,
      ...(cursor ? { skip: 1, cursor } : {}),
      include: {
        giver: { select: { id: true, firstName: true, avatarUrl: true, giverRatingAvg: true, transactionCount: true } },
        claims: true,
        _count: { select: { claims: true } },
      },
    });

    // If coordinates are provided, compute exact Haversine distance and prune
    let filteredItems = items;
    if (viewerLat !== null && viewerLng !== null) {
      filteredItems = items
        .map((g) => {
          if (g.latitude != null && g.longitude != null) {
            const d = calculateHaversineDistanceKm(viewerLat!, viewerLng!, g.latitude, g.longitude);
            return Object.assign(g, { distanceKm: d });
          }
          return g;
        })
        .filter((g) => {
          const d = (g as { distanceKm?: number }).distanceKm;
          if (d != null) {
            return d <= effectiveRadiusKm;
          }
          return !distanceSettings.strictDistanceOnly;
        });

      if (query.sort === 'distance_asc') {
        filteredItems.sort((a, b) => {
          const da = (a as { distanceKm?: number }).distanceKm ?? 999999;
          const db = (b as { distanceKm?: number }).distanceKm ?? 999999;
          return da - db;
        });
      }
    }

    // Fallback: If 0 items found locally and strict distance is off (when no explicit search or filter was applied),
    // broaden to all open community giveaways so the feed is never empty.
    if (
      filteredItems.length === 0 &&
      !distanceSettings.strictDistanceOnly &&
      !query.country &&
      !query.location &&
      !query.q &&
      query.status === 'open' &&
      !cursor
    ) {
      filteredItems = await prisma.giveaway.findMany({
        where: {
          status: 'open',
          ...(query.hasPhoto === true ? { photoUrl: { not: null } } : {}),
        },
        orderBy: orderBy as never,
        take: query.limit + 1,
        include: {
          giver: { select: { id: true, firstName: true, avatarUrl: true, giverRatingAvg: true, transactionCount: true } },
          claims: true,
          _count: { select: { claims: true } },
        },
      });
    }

    const hasMore = filteredItems.length > query.limit;
    const page = hasMore ? filteredItems.slice(0, query.limit) : filteredItems;

    let myClaims = new Map<string, typeof items[0]['claims'][0]>();
    if (viewerId && page.length > 0) {
      const myClaimRows = await prisma.giveawayClaim.findMany({
        where: { claimerUserId: viewerId, giveawayId: { in: page.map((g) => g.id) } },
      });
      myClaims = new Map(myClaimRows.map((c) => [c.giveawayId, c]));
    }

    return {
      items: page.map((g) => toApiGiveaway(g, { myClaim: myClaims.get(g.id) ?? null })),
      cursor: hasMore ? page[page.length - 1]!.id : null,
    };
  });
}
