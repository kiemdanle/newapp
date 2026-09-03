import type {
  FeedbackTicket as DbFeedbackTicket,
  FeedbackAttachment as DbFeedbackAttachment,
  FeedbackMessage as DbFeedbackMessage,
  User as DbUser,
  Prisma,
} from '@prisma/client';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import {
  ERROR_CODES,
  type FeedbackTicket,
  type FeedbackTicketDetail,
  type FeedbackAttachment,
  type FeedbackMessage,
  type CreateFeedbackTicketInput,
  type FeedbackListQuery,
  type FeedbackListPage,
  type FeedbackReplyInput,
  type UpdateFeedbackStatusInput,
} from '@expyrico/shared';
import type {
  AdminFeedbackQuery,
  AdminFeedbackRow,
  AdminFeedbackListPage,
  AdminFeedbackCounts,
} from '@expyrico/shared';
import { enqueueOutbox } from '../notifications/outbox.js';
import { dispatchFeedbackAdminAlertOutbox } from './admin-alert-outbox.js';
export function toApiFeedbackAttachment(att: DbFeedbackAttachment): FeedbackAttachment {
  return {
    id: att.id,
    ticketId: att.ticketId,
    uploaderId: att.uploaderId,
    fileName: att.fileName,
    mimeType: att.mimeType,
    fileSizeBytes: att.fileSizeBytes,
    storageKey: att.storageKey,
    url: `/feedback/attachments/${att.id}`,
    createdAt: att.createdAt.toISOString(),
  };
}

export function toApiFeedbackMessage(msg: DbFeedbackMessage): FeedbackMessage {
  return {
    id: msg.id,
    ticketId: msg.ticketId,
    senderType: msg.senderType,
    senderUserId: msg.senderUserId,
    message: msg.message,
    createdAt: msg.createdAt.toISOString(),
  };
}

export function toApiFeedbackTicket(
  ticket: DbFeedbackTicket & {
    _count?: { attachments: number; messages: number };
  },
): FeedbackTicket {
  return {
    id: ticket.id,
    userId: ticket.userId,
    type: ticket.type,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    deviceInfo: (ticket.deviceInfo as any) ?? null,
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    resolvedBy: ticket.resolvedBy ?? null,
    resolutionNotes: ticket.resolutionNotes ?? null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    attachmentsCount: ticket._count?.attachments,
    messagesCount: ticket._count?.messages,
  };
}

export function toApiFeedbackTicketDetail(
  ticket: DbFeedbackTicket & {
    attachments: DbFeedbackAttachment[];
    messages: DbFeedbackMessage[];
  },
): FeedbackTicketDetail {
  return {
    ...toApiFeedbackTicket(ticket),
    attachments: ticket.attachments.map(toApiFeedbackAttachment),
    messages: ticket.messages.map(toApiFeedbackMessage),
  };
}

export function toApiAdminFeedbackRow(
  ticket: DbFeedbackTicket & {
    user: DbUser;
    resolver?: DbUser | null;
    attachments?: DbFeedbackAttachment[];
  },
): AdminFeedbackRow {
  return {
    ...toApiFeedbackTicket(ticket),
    user: {
      id: ticket.user.id,
      email: ticket.user.email,
      firstName: ticket.user.firstName,
      lastName: ticket.user.lastName,
      avatarUrl: ticket.user.avatarUrl,
    },
    resolver: ticket.resolver
      ? {
          id: ticket.resolver.id,
          email: ticket.resolver.email,
          firstName: ticket.resolver.firstName,
          lastName: ticket.resolver.lastName,
        }
      : null,
    attachments: ticket.attachments?.map(toApiFeedbackAttachment),
  };
}

/**
 * Creates a new feedback ticket, binds any uploaded attachments,
 * creates the opening message, and logs notification outbox.
 */
export async function createFeedbackTicket(
  userId: string,
  input: CreateFeedbackTicketInput,
): Promise<FeedbackTicketDetail> {
  const prisma = getPrisma();

  const { detail, user } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (input.attachmentIds && input.attachmentIds.length > 0) {
      const attachments = await tx.feedbackAttachment.findMany({
        where: {
          id: { in: input.attachmentIds },
          uploaderId: userId,
        },
      });

      if (attachments.length !== input.attachmentIds.length) {
        throw new AppError({
          status: 400,
          code: ERROR_CODES.FEEDBACK_ATTACHMENT_NOT_FOUND,
          title: 'One or more attachment IDs are invalid or belong to another user',
        });
      }

      const alreadyLinked = attachments.some((a) => a.ticketId !== null);
      if (alreadyLinked) {
        throw new AppError({
          status: 400,
          code: ERROR_CODES.VALIDATION,
          title: 'One or more attachments are already linked to an existing ticket',
        });
      }
    }

    // 2. Create the ticket
    const ticket = await tx.feedbackTicket.create({
      data: {
        userId,
        type: input.type,
        title: input.title,
        description: input.description,
        deviceInfo: (input.deviceInfo as any) ?? undefined,
        status: 'open',
      },
    });

    // 3. Link attachments if any
    if (input.attachmentIds && input.attachmentIds.length > 0) {
      await tx.feedbackAttachment.updateMany({
        where: { id: { in: input.attachmentIds } },
        data: { ticketId: ticket.id },
      });
    }

    // 4. Create initial opening message
    const initialMessage = await tx.feedbackMessage.create({
      data: {
        ticketId: ticket.id,
        senderType: 'user',
        senderUserId: userId,
        message: input.description,
      },
    });
    // 5. Persist durable admin alert in the outbox inside the same transaction
    await tx.feedbackAdminAlertOutbox.create({
      data: {
        ticketId: ticket.id,
        status: 'pending',
      },
    });

    const fullTicket = await tx.feedbackTicket.findUniqueOrThrow({
      where: { id: ticket.id },
      include: {
        attachments: { orderBy: { createdAt: 'asc' } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    return { detail: toApiFeedbackTicketDetail(fullTicket), user };
  });

  // 6. Non-blocking outbox dispatch trigger
  void dispatchFeedbackAdminAlertOutbox().catch(() => {});

  return detail;
}

/**
 * Lists tickets filed by a specific user with cursor pagination.
 */
export async function listUserFeedbackTickets(
  userId: string,
  query: FeedbackListQuery,
): Promise<FeedbackListPage> {
  const prisma = getPrisma();
  const limit = query.limit;

  const where: Prisma.FeedbackTicketWhereInput = {
    userId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.type ? { type: query.type } : {}),
  };

  const rows = await prisma.feedbackTicket.findMany({
    where,
    take: limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor } } : {}),
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { attachments: true, messages: true } },
    },
  });

  let nextCursor: string | null = null;
  if (rows.length > limit) {
    const nextItem = rows.pop()!;
    nextCursor = nextItem.id;
  }

  return {
    items: rows.map(toApiFeedbackTicket),
    nextCursor,
  };
}

/**
 * Fetches ticket detail with messages and attachments for the ticket owner.
 */
export async function getUserFeedbackTicketDetail(
  userId: string,
  ticketId: string,
): Promise<FeedbackTicketDetail> {
  const prisma = getPrisma();

  const ticket = await prisma.feedbackTicket.findUnique({
    where: { id: ticketId },
    include: {
      attachments: { orderBy: { createdAt: 'asc' } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!ticket || ticket.userId !== userId) {
    throw new AppError({
      status: 404,
      code: ERROR_CODES.FEEDBACK_NOT_FOUND,
      title: 'Feedback ticket not found',
    });
  }

  return toApiFeedbackTicketDetail(ticket);
}

/**
 * User appends a reply message to their open/active ticket.
 */
export async function addUserFeedbackMessage(
  userId: string,
  ticketId: string,
  input: FeedbackReplyInput,
): Promise<FeedbackMessage> {
  const prisma = getPrisma();

  return await prisma.$transaction(async (tx) => {
    const ticket = await tx.feedbackTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.userId !== userId) {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.FEEDBACK_NOT_FOUND,
        title: 'Feedback ticket not found',
      });
    }

    if (ticket.status === 'closed' || ticket.status === 'resolved') {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.FEEDBACK_CASE_CLOSED,
        title: 'Cannot reply to a closed or resolved ticket. Please submit a new ticket.',
      });
    }

    const msg = await tx.feedbackMessage.create({
      data: {
        ticketId,
        senderType: 'user',
        senderUserId: userId,
        message: input.message,
      },
    });

    // If ticket was in replied status, transition back to in_progress so admin sees new reply
    if (ticket.status === 'replied') {
      await tx.feedbackTicket.update({
        where: { id: ticketId },
        data: { status: 'in_progress', updatedAt: new Date() },
      });
    }

    return toApiFeedbackMessage(msg);
  });
}

/**
 * Admin: List all tickets with search and filters.
 */
export async function listAdminFeedbackTickets(
  query: AdminFeedbackQuery,
): Promise<AdminFeedbackListPage> {
  const prisma = getPrisma();
  const limit = query.limit;

  const where: Prisma.FeedbackTicketWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.type ? { type: query.type } : {}),
  };

  if (query.search) {
    const s = query.search;
    where.OR = [
      { title: { contains: s, mode: 'insensitive' } },
      { description: { contains: s, mode: 'insensitive' } },
      { user: { email: { contains: s, mode: 'insensitive' } } },
      { user: { firstName: { contains: s, mode: 'insensitive' } } },
      { user: { lastName: { contains: s, mode: 'insensitive' } } },
    ];
  }

  const rows = await prisma.feedbackTicket.findMany({
    where,
    take: limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor } } : {}),
    orderBy: { createdAt: 'desc' },
    include: {
      user: true,
      resolver: true,
      attachments: true,
      _count: { select: { messages: true, attachments: true } },
    },
  });

  let nextCursor: string | null = null;
  if (rows.length > limit) {
    const nextItem = rows.pop()!;
    nextCursor = nextItem.id;
  }

  return {
    items: rows.map(toApiAdminFeedbackRow),
    nextCursor,
  };
}

/**
 * Admin: Retrieve ticket with complete conversation and diagnostics.
 */
export async function getAdminFeedbackTicketDetail(
  ticketId: string,
): Promise<AdminFeedbackRow & { messages: FeedbackMessage[] }> {
  const prisma = getPrisma();

  const ticket = await prisma.feedbackTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: true,
      resolver: true,
      attachments: { orderBy: { createdAt: 'asc' } },
      messages: { orderBy: { createdAt: 'asc' } },
      _count: { select: { messages: true, attachments: true } },
    },
  });

  if (!ticket) {
    throw new AppError({
      status: 404,
      code: ERROR_CODES.FEEDBACK_NOT_FOUND,
      title: 'Feedback ticket not found',
    });
  }

  const row = toApiAdminFeedbackRow(ticket);
  return {
    ...row,
    messages: ticket.messages.map(toApiFeedbackMessage),
  };
}

/**
 * Admin: Send reply to user, update status to replied, and enqueue push notification.
 */
export async function addAdminFeedbackReply(
  adminUserId: string,
  ticketId: string,
  input: FeedbackReplyInput,
): Promise<FeedbackMessage> {
  const prisma = getPrisma();

  return await prisma.$transaction(async (tx) => {
    const ticket = await tx.feedbackTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.FEEDBACK_NOT_FOUND,
        title: 'Feedback ticket not found',
      });
    }

    // 1. Create admin message
    const msg = await tx.feedbackMessage.create({
      data: {
        ticketId,
        senderType: 'admin',
        senderUserId: adminUserId,
        message: input.message,
      },
    });

    // 2. Set status to replied
    await tx.feedbackTicket.update({
      where: { id: ticketId },
      data: { status: 'replied', updatedAt: new Date() },
    });

    // 3. Enqueue push notification to user
    await enqueueOutbox(tx, {
      userId: ticket.userId,
      templateKey: 'feedback_reply',
      payload: {
        ticketId: ticket.id,
        title: ticket.title,
      },
    });

    return toApiFeedbackMessage(msg);
  });
}

/**
 * Admin: Update ticket status (e.g. resolved, closed, in_progress).
 */
export async function updateAdminFeedbackStatus(
  adminUserId: string,
  ticketId: string,
  input: UpdateFeedbackStatusInput,
): Promise<FeedbackTicket> {
  const prisma = getPrisma();

  return await prisma.$transaction(async (tx) => {
    const ticket = await tx.feedbackTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.FEEDBACK_NOT_FOUND,
        title: 'Feedback ticket not found',
      });
    }

    const isResolving = input.status === 'resolved' || input.status === 'closed';

    const updated = await tx.feedbackTicket.update({
      where: { id: ticketId },
      data: {
        status: input.status,
        resolvedAt: isResolving ? new Date() : null,
        resolvedBy: isResolving ? adminUserId : null,
        resolutionNotes: isResolving ? input.resolutionNotes ?? null : null,
        updatedAt: new Date(),
      },
    });

    // If marked resolved, enqueue user push notification
    if (input.status === 'resolved') {
      await enqueueOutbox(tx, {
        userId: ticket.userId,
        templateKey: 'feedback_case_resolved',
        payload: {
          ticketId: ticket.id,
          title: ticket.title,
        },
      });
    }

    return toApiFeedbackTicket(updated);
  });
}

/**
 * Admin: Get ticket counts across statuses for badge counters.
 */
export async function getAdminFeedbackCounts(): Promise<AdminFeedbackCounts> {
  const prisma = getPrisma();

  const [total, open, inProgress, replied, resolved, closed] = await Promise.all([
    prisma.feedbackTicket.count(),
    prisma.feedbackTicket.count({ where: { status: 'open' } }),
    prisma.feedbackTicket.count({ where: { status: 'in_progress' } }),
    prisma.feedbackTicket.count({ where: { status: 'replied' } }),
    prisma.feedbackTicket.count({ where: { status: 'resolved' } }),
    prisma.feedbackTicket.count({ where: { status: 'closed' } }),
  ]);

  return {
    total,
    open,
    inProgress,
    replied,
    resolved,
    closed,
  };
}
