import { z } from 'zod';
export declare const queueHealthSchema: z.ZodObject<{
    queues: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        waiting: z.ZodNumber;
        active: z.ZodNumber;
        completed: z.ZodNumber;
        failed: z.ZodNumber;
        delayed: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        active: number;
        name: string;
        waiting: number;
        completed: number;
        failed: number;
        delayed: number;
    }, {
        active: number;
        name: string;
        waiting: number;
        completed: number;
        failed: number;
        delayed: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    queues: {
        active: number;
        name: string;
        waiting: number;
        completed: number;
        failed: number;
        delayed: number;
    }[];
}, {
    queues: {
        active: number;
        name: string;
        waiting: number;
        completed: number;
        failed: number;
        delayed: number;
    }[];
}>;
export declare const pushLogRowSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    templateKey: z.ZodString;
    status: z.ZodEnum<["sent", "failed"]>;
    errorMessage: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "failed" | "sent";
    createdAt: string;
    userId: string;
    templateKey: string;
    errorMessage: string | null;
}, {
    id: string;
    status: "failed" | "sent";
    createdAt: string;
    userId: string;
    templateKey: string;
    errorMessage: string | null;
}>;
export declare const pushLogsQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
} & {
    userId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["sent", "failed"]>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    status?: "failed" | "sent" | undefined;
    userId?: string | undefined;
    cursor?: string | undefined;
}, {
    status?: "failed" | "sent" | undefined;
    userId?: string | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
export declare const pushLogsListSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        templateKey: z.ZodString;
        status: z.ZodEnum<["sent", "failed"]>;
        errorMessage: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "failed" | "sent";
        createdAt: string;
        userId: string;
        templateKey: string;
        errorMessage: string | null;
    }, {
        id: string;
        status: "failed" | "sent";
        createdAt: string;
        userId: string;
        templateKey: string;
        errorMessage: string | null;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        status: "failed" | "sent";
        createdAt: string;
        userId: string;
        templateKey: string;
        errorMessage: string | null;
    }[];
    nextCursor: string | null;
}, {
    items: {
        id: string;
        status: "failed" | "sent";
        createdAt: string;
        userId: string;
        templateKey: string;
        errorMessage: string | null;
    }[];
    nextCursor: string | null;
}>;
export declare const apiErrorsQuerySchema: z.ZodObject<{
    range: z.ZodDefault<z.ZodEnum<["24h", "7d", "30d"]>>;
}, "strip", z.ZodTypeAny, {
    range: "7d" | "30d" | "24h";
}, {
    range?: "7d" | "30d" | "24h" | undefined;
}>;
export declare const apiErrorsAggSchema: z.ZodObject<{
    range: z.ZodEnum<["24h", "7d", "30d"]>;
    rows: z.ZodArray<z.ZodObject<{
        route: z.ZodString;
        method: z.ZodString;
        status: z.ZodNumber;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: number;
        count: number;
        route: string;
        method: string;
    }, {
        status: number;
        count: number;
        route: string;
        method: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    range: "7d" | "30d" | "24h";
    rows: {
        status: number;
        count: number;
        route: string;
        method: string;
    }[];
}, {
    range: "7d" | "30d" | "24h";
    rows: {
        status: number;
        count: number;
        route: string;
        method: string;
    }[];
}>;
export declare const externalApiStateSchema: z.ZodObject<{
    breakers: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        state: z.ZodEnum<["closed", "open", "halfOpen"]>;
        fires: z.ZodNumber;
        failures: z.ZodNumber;
        successes: z.ZodNumber;
        lastFailureAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        state: "open" | "closed" | "halfOpen";
        fires: number;
        failures: number;
        successes: number;
        lastFailureAt: string | null;
    }, {
        name: string;
        state: "open" | "closed" | "halfOpen";
        fires: number;
        failures: number;
        successes: number;
        lastFailureAt: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    breakers: {
        name: string;
        state: "open" | "closed" | "halfOpen";
        fires: number;
        failures: number;
        successes: number;
        lastFailureAt: string | null;
    }[];
}, {
    breakers: {
        name: string;
        state: "open" | "closed" | "halfOpen";
        fires: number;
        failures: number;
        successes: number;
        lastFailureAt: string | null;
    }[];
}>;
//# sourceMappingURL=system.d.ts.map