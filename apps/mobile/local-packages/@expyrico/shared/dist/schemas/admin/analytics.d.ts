import { z } from 'zod';
export declare const analyticsRangeSchema: z.ZodEnum<["7d", "30d", "90d"]>;
export declare const analyticsOverviewSchema: z.ZodObject<{
    totalUsers: z.ZodNumber;
    activeUsers7d: z.ZodNumber;
    activeUsers30d: z.ZodNumber;
    totalRecords: z.ZodNumber;
    totalReviews: z.ZodNumber;
    scans7d: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    totalUsers: number;
    activeUsers7d: number;
    activeUsers30d: number;
    totalRecords: number;
    totalReviews: number;
    scans7d: number;
}, {
    totalUsers: number;
    activeUsers7d: number;
    activeUsers30d: number;
    totalRecords: number;
    totalReviews: number;
    scans7d: number;
}>;
export declare const analyticsDailyPointSchema: z.ZodObject<{
    date: z.ZodString;
    count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    date: string;
    count: number;
}, {
    date: string;
    count: number;
}>;
export declare const analyticsScansSchema: z.ZodObject<{
    range: z.ZodEnum<["7d", "30d", "90d"]>;
    daily: z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        date: string;
        count: number;
    }, {
        date: string;
        count: number;
    }>, "many">;
    bySource: z.ZodObject<{
        off: z.ZodNumber;
        upcitemdb: z.ZodNumber;
        manual: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        off: number;
        upcitemdb: number;
        manual: number;
    }, {
        off: number;
        upcitemdb: number;
        manual: number;
    }>;
}, "strip", z.ZodTypeAny, {
    range: "7d" | "30d" | "90d";
    daily: {
        date: string;
        count: number;
    }[];
    bySource: {
        off: number;
        upcitemdb: number;
        manual: number;
    };
}, {
    range: "7d" | "30d" | "90d";
    daily: {
        date: string;
        count: number;
    }[];
    bySource: {
        off: number;
        upcitemdb: number;
        manual: number;
    };
}>;
export declare const analyticsReviewsSchema: z.ZodObject<{
    range: z.ZodEnum<["7d", "30d", "90d"]>;
    daily: z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        date: string;
        count: number;
    }, {
        date: string;
        count: number;
    }>, "many">;
    autoFlaggedRate: z.ZodNumber;
    buyAgainPct: z.ZodNumber;
    buyAgainOnSalePct: z.ZodNumber;
    wontBuyPct: z.ZodNumber;
    ratingCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    ratingCount: number;
    range: "7d" | "30d" | "90d";
    daily: {
        date: string;
        count: number;
    }[];
    autoFlaggedRate: number;
    buyAgainPct: number;
    buyAgainOnSalePct: number;
    wontBuyPct: number;
}, {
    ratingCount: number;
    range: "7d" | "30d" | "90d";
    daily: {
        date: string;
        count: number;
    }[];
    autoFlaggedRate: number;
    buyAgainPct: number;
    buyAgainOnSalePct: number;
    wontBuyPct: number;
}>;
export declare const analyticsGeographySchema: z.ZodObject<{
    top: z.ZodArray<z.ZodObject<{
        country: z.ZodString;
        users: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        country: string;
        users: number;
    }, {
        country: string;
        users: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    top: {
        country: string;
        users: number;
    }[];
}, {
    top: {
        country: string;
        users: number;
    }[];
}>;
//# sourceMappingURL=analytics.d.ts.map