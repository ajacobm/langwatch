import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

import { nanoid } from "nanoid";
import {
  TeamRoleGroup,
  checkPermissionOrPubliclyShared,
  checkUserPermissionForProject,
} from "../permission";
import { PublicShareResourceTypes } from "@prisma/client";

const scoreOptionSchema = z.object({
  value: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
});

const scoreOptions = z.record(z.string(), scoreOptionSchema);

export const annotationRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        comment: z.string().optional().nullable(),
        isThumbsUp: z.boolean().optional().nullable(),
        traceId: z.string(),
        scoreOptions: scoreOptions,
      })
    )
    .use(checkUserPermissionForProject(TeamRoleGroup.ANNOTATIONS_MANAGE))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.annotation.create({
        data: {
          id: nanoid(),
          projectId: input.projectId,
          comment: input.comment ?? "",
          isThumbsUp: input.isThumbsUp ?? null,
          traceId: input.traceId,
          userId: ctx.session.user.id,
          scoreOptions: input.scoreOptions ?? {},
        },
      });
    }),
  updateByTraceId: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        traceId: z.string(),
        projectId: z.string(),
        comment: z.string().optional().nullable(),
        isThumbsUp: z.boolean().optional().nullable(),
        scoreOptions: scoreOptions,
      })
    )
    .use(checkUserPermissionForProject(TeamRoleGroup.ANNOTATIONS_MANAGE))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.annotation.update({
        where: {
          id: input.id,
          projectId: input.projectId,
          traceId: input.traceId,
        },
        data: {
          comment: input.comment ?? "",
          isThumbsUp: input.isThumbsUp ?? false,
          scoreOptions: input.scoreOptions ?? {},
        },
      });
    }),
  getByTraceId: publicProcedure
    .input(
      z.object({
        traceId: z.string(),
        projectId: z.string(),
      })
    )
    .use(
      checkPermissionOrPubliclyShared(
        checkUserPermissionForProject(TeamRoleGroup.ANNOTATIONS_VIEW),
        {
          resourceType: PublicShareResourceTypes.TRACE,
          resourceParam: "traceId",
        }
      )
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.annotation.findMany({
        where: {
          traceId: input.traceId,
          projectId: input.projectId,
        },
        include: {
          user: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });
    }),
  getByTraceIds: protectedProcedure
    .input(
      z.object({
        traceIds: z.array(z.string()),
        projectId: z.string(),
      })
    )
    .use(checkUserPermissionForProject(TeamRoleGroup.ANNOTATIONS_VIEW))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.annotation.findMany({
        where: {
          traceId: {
            in: input.traceIds,
          },
          projectId: input.projectId,
        },
        include: {
          user: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });
    }),
  getById: protectedProcedure
    .input(z.object({ annotationId: z.string(), projectId: z.string() }))
    .use(checkUserPermissionForProject(TeamRoleGroup.ANNOTATIONS_VIEW))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.annotation.findUnique({
        where: {
          id: input.annotationId,
          projectId: input.projectId,
        },
      });
    }),
  deleteById: protectedProcedure
    .input(z.object({ annotationId: z.string(), projectId: z.string() }))
    .use(checkUserPermissionForProject(TeamRoleGroup.ANNOTATIONS_MANAGE))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.annotation.delete({
        where: {
          id: input.annotationId,
          projectId: input.projectId,
        },
      });
    }),
  getAll: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .use(checkUserPermissionForProject(TeamRoleGroup.ANNOTATIONS_VIEW))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.annotation.findMany({
        where: {
          projectId: input.projectId,
          createdAt: {
            gte: input.startDate,
            lte: input.endDate,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          user: true,
        },
      });
    }),
});
