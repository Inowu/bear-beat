import { z } from 'zod';
import bcrypt from 'bcrypt';
import pm2 from 'pm2';
import { subMonths } from 'date-fns';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../procedures/shielded.procedure';
import { router } from '../trpc';
import { UsersAggregateSchema } from '../schemas/aggregateUsers.schema';
import { UsersCreateManySchema } from '../schemas/createManyUsers.schema';
import { UsersCreateOneSchema } from '../schemas/createOneUsers.schema';
import { UsersDeleteManySchema } from '../schemas/deleteManyUsers.schema';
import { UsersDeleteOneSchema } from '../schemas/deleteOneUsers.schema';
import { UsersFindFirstSchema } from '../schemas/findFirstUsers.schema';
import { UsersFindManySchema } from '../schemas/findManyUsers.schema';
import { UsersFindUniqueSchema } from '../schemas/findUniqueUsers.schema';
import { UsersGroupBySchema } from '../schemas/groupByUsers.schema';
import { UsersUpdateManySchema } from '../schemas/updateManyUsers.schema';
import { UsersUpdateOneSchema } from '../schemas/updateOneUsers.schema';
import { UsersUpsertSchema } from '../schemas/upsertOneUsers.schema';
import { log } from '../server';
import { cancelServicesSubscriptions } from './subscriptions/cancel/cancelServicesSubscriptions';
import { RolesIds } from './auth/interfaces/roles.interface';
import { removeUsersQueue } from '../queue/removeUsers';
import { RemoveUsersJob } from '../queue/removeUsers/types';
import { JobStatus } from '../queue/jobStatus';
import { manyChat } from '../many-chat';

const validateExistingData = async (data: any, prisma: any, id: number) => {
  if (data.username) {
    const existingUser = await prisma.users.findFirst({
      where: {
        AND: [
          {
            id: {
              not: id
            }
          }
        ],
        OR: [
          {
            username: {
              equals: data.username.toString(),
            },
          },
        ],

      },
    });

    if (existingUser) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Ese nombre de usuario ya está registrado',
      });
    }
  }
  if (data.email) {
    const existingUser = await prisma.users.findFirst({
      where: {
        AND: [
          {
            id: {
              not: id
            }
          }
        ],
        OR: [
          {
            email: {
              equals: data.email.toString(),
            },
          },
        ],

      },
    });

    if (existingUser) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Ese email ya está registrado',
      });
    }
  }
  if (data.phone) {
    const existingUser = await prisma.users.findFirst({
      where: {
        AND: [
          {
            id: {
              not: id
            }
          }
        ],
        OR: [
          {
            phone: {
              equals: data.phone.toString(),
            },
          },
        ],

      },
    });

    if (existingUser) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Ese teléfono ya está registrado',
      });
    }
  }
}

export const usersRouter = router({
  getActiveUsers: shieldedProcedure
    .input(UsersFindManySchema)
    .query(async ({ ctx: { prisma }, input }) => {
      const activeSubs = await prisma.descargasUser.findMany({
        where: {
          date_end: {
            gte: new Date(),
          },
        },
      });

      const activeUsers = await prisma.users.findMany({
        ...input,
        where: {
          AND: [
            {
              ...input.where,
            },
            {
              id: {
                in: activeSubs.map((user) => user.user_id),
              },
            },
            {
              NOT: {
                role_id: RolesIds.admin,
              },
            },
          ],
        },
      });

      return activeUsers;
    }),
  getInactiveUsers: shieldedProcedure
    .input(UsersFindManySchema)
    .query(async ({ ctx: { prisma }, input }) => {
      const activeSubs = await prisma.descargasUser.findMany({
        where: {
          date_end: {
            gte: new Date(),
          },
        },
      });

      const inactiveUsers = await prisma.users.findMany({
        ...input,
        where: {
          AND: [
            {
              ...input.where,
            },
            {
              id: {
                notIn: activeSubs.map((user) => user.user_id),
              },
            },
            {
              NOT: {
                role_id: RolesIds.admin,
              },
            },
          ],
        },
      });

      return inactiveUsers;
    }),
  blockUser: shieldedProcedure
    .input(
      z.object({
        userId: z.number(),
      }),
    )
    .mutation(async ({ ctx: { prisma }, input: { userId } }) => {
      const user = await prisma.users.findFirst({
        where: {
          id: userId,
        },
      });

      if (!user) {
        log.error(`[BLOCK_USER] User ${userId} not found`);
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Usuario no encontrado',
        });
      }

      try {
        log.info(`[BLOCK_USER] Canceling subscription for user ${userId}`);
        await cancelServicesSubscriptions({ prisma, user });
      } catch (e) {
        log.error(
          `[BLOCK_USER] Error cancelling subscription for user ${userId}, ${e}`,
        );
      }

      log.info(`[BLOCK_USER] Blocking user ${userId}`);

      await prisma.users.update({
        where: {
          id: user.id,
        },
        data: {
          blocked: true,
        },
      });

      return user;
    }),
  unblockUser: shieldedProcedure
    .input(
      z.object({
        userId: z.number(),
      }),
    )
    .mutation(async ({ ctx: { prisma }, input: { userId } }) => {
      const user = await prisma.users.findFirst({
        where: {
          id: userId,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Usuario no encontrado',
        });
      }

      await prisma.users.update({
        where: {
          id: user.id,
        },
        data: {
          blocked: false,
        },
      });

      return user;
    }),
  removeInactiveUsers: shieldedProcedure.mutation(
    async ({ ctx: { prisma, session } }) => {
      const existingJob = await prisma.jobs.findFirst({
        where: {
          AND: [
            {
              queue: process.env.REMOVE_USERS_QUEUE_NAME as string,
            },
            {
              status: JobStatus.IN_PROGRESS,
            },
          ],
        },
      });

      if (existingJob) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message:
            'Ya hay una eliminación en proceso, espere a que termine antes de iniciar otro proceso de eliminación',
        });
      }

      const activeUsers = await prisma.descargasUser.findMany({
        where: {
          date_end: {
            gte: subMonths(new Date(), 1),
          },
        },
      });

      const inactiveUsers = await prisma.users.findMany({
        where: {
          AND: [
            {
              id: {
                notIn: activeUsers.map((user) => user.user_id),
              },
            },
            {
              NOT: {
                role_id: RolesIds.admin,
              },
            },
          ],
        },
      });

      const inactiveUsersIds = inactiveUsers.map((user) => user.id);
      const inactiveUsersEmails = inactiveUsers.map((user) => {
        return {
          email: user.email,
          deletionDate: new Date().toISOString(),
          reactivated: false,
        }
      });

      const ftpAccounts = await prisma.ftpUser.findMany({
        where: {
          user_id: {
            in: inactiveUsersIds,
          },
        },
      });

      const tallies = await prisma.ftpquotatallies.findMany({
        where: {
          name: {
            in: ftpAccounts.map((account) => account.userid),
          },
        },
      });

      const limits = await prisma.ftpQuotaLimits.findMany({
        where: {
          name: {
            in: ftpAccounts.map((account) => account.userid),
          },
        },
      });

      try {
        await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS=0`;

        await prisma.$transaction([
          prisma.ftpquotatallies.deleteMany({
            where: {
              id: {
                in: tallies.map((tally) => tally.id),
              },
            },
          }),
          prisma.ftpQuotaLimits.deleteMany({
            where: {
              id: {
                in: limits.map((limit) => limit.id),
              },
            },
          }),
          prisma.ftpUser.deleteMany({
            where: {
              user_id: {
                in: inactiveUsersIds,
              },
            },
          }),
          prisma.descargasUser.deleteMany({
            where: {
              user_id: {
                in: inactiveUsersIds,
              },
            },
          }),
          prisma.orders.deleteMany({
            where: {
              user_id: {
                in: inactiveUsersIds,
              },
            },
          }),
          prisma.dir_downloads.deleteMany({
            where: {
              userId: {
                in: inactiveUsersIds,
              },
            },
          }),
          prisma.cuponsUsed.deleteMany({
            where: {
              user_id: {
                in: inactiveUsersIds,
              },
            },
          }),
          prisma.checkout_logs.deleteMany({
            where: {
              user_id: {
                in: inactiveUsersIds,
              },
            },
          }),
          prisma.jobs.deleteMany({
            where: {
              user_id: {
                in: inactiveUsersIds,
              },
            },
          }),
          prisma.users.deleteMany({
            where: {
              AND: [
                {
                  id: {
                    in: inactiveUsersIds,
                  },
                },
                {
                  NOT: {
                    role_id: RolesIds.admin,
                  },
                },
              ],
            },
          }),
          prisma.deletedUsers.createMany({
            data: inactiveUsersEmails
          }),
        ]);

        await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS=1`;
      } catch (e) {
        log.error(
          `[REMOVE_INACTIVE_USERS] Error removing inactive users, ${e}`,
        );
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Ocurrió un error al eliminar usuarios inactivos',
        });
      }

      // Push job to queue
      const job = await removeUsersQueue.add(
        process.env.REMOVE_USERS_QUEUE_NAME as string,
        {
          userCustomerIds: inactiveUsers
            .slice(0, 500)
            .map(
              (
                user,
              ): {
                stripe: string | undefined | null;
                conekta: string | undefined | null;
              } => ({
                stripe: user.stripe_cusid,
                conekta: user.conekta_cusid,
              }),
            )
            .filter((user) => user.stripe || user.conekta),
          userId: session!.user!.id,
        } as RemoveUsersJob,
      );

      await prisma.jobs.create({
        data: {
          jobId: job.id,
          status: JobStatus.IN_PROGRESS,
          user_id: session!.user!.id,
          queue: process.env.REMOVE_USERS_QUEUE_NAME as string,
          createdAt: new Date(),
        },
      });

      log.info(`[REMOVE_INACTIVE_USERS] Starting worker for job ${job.id}`);
      pm2.start(
        {
          name: `removeUsers-${session!.user!.id}-${job.id}`,
          namespace: process.env.REMOVE_USERS_QUEUE_NAME as string,
          autorestart: false,
        },
        (err) => {
          if (err) {
            log.error(
              `[REMOVE_INACTIVE_USERS] Error starting pm2 process, ${err}`,
            );
          }
        },
      );

      return {
        message:
          'Se han eliminado los usuarios inactivos y se ha iniciado el proceso de eliminación de sus cuentas en Stripe y Conekta',
      };
    },
  ),
  addManyChatTagToUser: shieldedProcedure
    .input(
      z.object({
        tag: z.union([
          z.literal('USER_CHECKED_PLANS'),
          z.literal('USER_REGISTERED'),
          z.literal('CHECKOUT_PLAN_ORO'),
          z.literal('CHECKOUT_PLAN_CURIOSO'),
          z.literal('SUCCESSFUL_PAYMENT'),
        ]),
      }),
    )
    .mutation(async ({ ctx: { prisma, session }, input: { tag } }) => {
      const user = await prisma.users.findFirst({
        where: {
          id: session!.user!.id,
        },
      });

      const response = await manyChat.addTagToUser(user!, tag);

      if (!response) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Ocurrió un error al agregar las etiquetas al usuario',
        });
      }

      return {
        message: 'Se han agregado las etiquetas a los usuarios',
      };
    }),
  sendFacebookEvent: shieldedProcedure
    .input(
      z.object({
        event: z.string()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { remoteAddress } = ctx.req.socket;
      const userAgent = ctx.req.headers['user-agent'];

      if (!remoteAddress || !userAgent) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'No hay suficiente información del usuario para enviar a Facebook'
        })
      }

      const user = await ctx.prisma.users.findFirst({
        where: {
          id: ctx.session!.user!.id,
        },
      });


    }),
  aggregateUsers: shieldedProcedure
    .input(UsersAggregateSchema)
    .query(async ({ ctx, input }) => {
      const aggregateUsers = await ctx.prisma.users.aggregate(input);
      return aggregateUsers;
    }),
  createManyUsers: shieldedProcedure
    .input(UsersCreateManySchema)
    .mutation(async ({ ctx, input }) => {
      const createManyUsers = await ctx.prisma.users.createMany(input);
      return createManyUsers;
    }),
  createOneUsers: shieldedProcedure
    .input(UsersCreateOneSchema)
    .mutation(async ({ ctx, input }) => {
      let { data } = input;
      data = { ...data, password: bcrypt.hashSync(data.password.toString(), 10) }
      input = { ...input, data }

      const existingUserWithEmail = await ctx.prisma.users.findFirst({
        where: {
          OR: [
            {
              username: {
                equals: data.username,
              },
            },
            {
              email: {
                equals: data.email,
              },
            },
          ],
        },
      });

      if (existingUserWithEmail) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ese email o nombre de usuario ya está registrado',
        });
      }

      const existingUserWithPhone = await ctx.prisma.users.findFirst({
        where: {
          OR: [
            {
              phone: {
                equals: data.phone
              }
            }
          ],
        },
      });

      if (existingUserWithPhone) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ese teléfono ya está registrado',
        });
      }

      const createOneUsers = await ctx.prisma.users.create(input);
      return createOneUsers;
    }),
  deleteManyUsers: shieldedProcedure
    .input(UsersDeleteManySchema)
    .mutation(async ({ ctx, input }) => {
      const deleteManyUsers = await ctx.prisma.users.deleteMany(input);
      return deleteManyUsers;
    }),
  deleteOneUsers: shieldedProcedure
    .input(UsersDeleteOneSchema)
    .mutation(async ({ ctx, input }) => {
      const deleteOneUsers = await ctx.prisma.users.delete(input);
      return deleteOneUsers;
    }),
  findFirstUsers: shieldedProcedure
    .input(UsersFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstUsers = await ctx.prisma.users.findFirst(input);
      return findFirstUsers;
    }),
  findFirstUsersOrThrow: shieldedProcedure
    .input(UsersFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstUsersOrThrow =
        await ctx.prisma.users.findFirstOrThrow(input);
      return findFirstUsersOrThrow;
    }),
  findManyUsers: shieldedProcedure
    .input(UsersFindManySchema)
    .query(async ({ ctx, input }) => {
      const findManyUsers = await ctx.prisma.users.findMany(input);
      return findManyUsers;
    }),
  findUniqueUsers: shieldedProcedure
    .input(UsersFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueUsers = await ctx.prisma.users.findUnique(input);
      return findUniqueUsers;
    }),
  findUniqueUsersOrThrow: shieldedProcedure
    .input(UsersFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueUsersOrThrow =
        await ctx.prisma.users.findUniqueOrThrow(input);
      return findUniqueUsersOrThrow;
    }),
  groupByUsers: shieldedProcedure
    .input(UsersGroupBySchema)
    .query(async ({ ctx, input }) => {
      const groupByUsers = await ctx.prisma.users.groupBy({
        where: input.where,
        orderBy: input.orderBy,
        by: input.by,
        having: input.having,
        take: input.take,
        skip: input.skip,
      });
      return groupByUsers;
    }),
  updateManyUsers: shieldedProcedure
    .input(UsersUpdateManySchema)
    .mutation(async ({ ctx, input }) => {
      const updateManyUsers = await ctx.prisma.users.updateMany(input);
      return updateManyUsers;
    }),
  updateOneUsers: shieldedProcedure
    .input(UsersUpdateOneSchema)
    .mutation(async ({ ctx, input }) => {
      let { data } = input;
      if (data.password) {
        data = { ...data, password: bcrypt.hashSync(data.password.toString(), 10) }
        input = { ...input, data }
      }

      if (data.username) {
        const existingUser = await ctx.prisma.users.findFirst({
          where: {
            AND: [
              {
                id: {
                  not: input.where.id
                }
              }
            ],
            OR: [
              {
                username: {
                  equals: data.username.toString(),
                },
              },
            ],

          },
        });

        if (existingUser) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Ese nombre de usuario ya está registrado',
          });
        }
      }
      if (data.email) {
        const existingUser = await ctx.prisma.users.findFirst({
          where: {
            AND: [
              {
                id: {
                  not: input.where.id
                }
              }
            ],
            OR: [
              {
                email: {
                  equals: data.email.toString(),
                },
              },
            ],

          },
        });

        if (existingUser) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Ese email ya está registrado',
          });
        }
      }
      if (data.phone) {
        const existingUser = await ctx.prisma.users.findFirst({
          where: {
            AND: [
              {
                id: {
                  not: input.where.id
                }
              }
            ],
            OR: [
              {
                phone: {
                  equals: data.phone.toString(),
                },
              },
            ],

          },
        });

        if (existingUser) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Ese teléfono ya está registrado',
          });
        }
      }

      const updateOneUsers = await ctx.prisma.users.update(input);
      return updateOneUsers;
    }),
  upsertOneUsers: shieldedProcedure
    .input(UsersUpsertSchema)
    .mutation(async ({ ctx, input }) => {
      const upsertOneUsers = await ctx.prisma.users.upsert(input);
      return upsertOneUsers;
    }),
  findManyUsersWithPlan: shieldedProcedure
    .input(UsersFindManySchema)
    .query(async ({ ctx, input }) => {
      const findManyUsers = await ctx.prisma.users.findMany(input);

      const usersWithPlan = await Promise.all(findManyUsers.map(async (user) => {
        const existingSubscription = await ctx.prisma.descargasUser.findFirst({
          where: {
            AND: [
              { user_id: user.id },
              {
                date_end: {
                  gte: new Date().toISOString(),
                },
              },
            ],
          },
        });

        return { ...user, hasSubscription: existingSubscription ? true : false }
      }))

      return usersWithPlan;
    }),
});