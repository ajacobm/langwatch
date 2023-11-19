import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import type { Session } from "next-auth";

export const checkUserPermissionForProject = async ({
  ctx,
  input,
  next,
}: {
  ctx: { prisma: PrismaClient; session: Session };
  input: { projectId: string };
  next: () => any;
}) => {
  const projectTeam = await ctx.prisma.project.findUnique({
    where: { id: input.projectId },
    select: {
      team: {
        select: { members: { where: { userId: ctx.session.user.id } } },
      },
    },
  });

  if (!projectTeam || projectTeam.team.members.length === 0) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next();
};
