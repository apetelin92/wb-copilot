import { CommitmentType, RiskLevel } from "@prisma/client";
import { z } from "zod";

import { recordAuditLog } from "@/server/lib/audit";
import { addUtcDays, enumerateUtcDays, startOfUtcDay } from "@/server/lib/date";
import { prisma } from "@/server/lib/prisma";
import { roundCurrency, toNumber } from "@/server/lib/number";
import { resolveOrganizationContext } from "@/server/modules/workspace/context";

export const cashInputsSchema = z.object({
  snapshot: z
    .object({
      snapshotDate: z.coerce.date(),
      availableRub: z.number(),
      notes: z.string().trim().max(500).optional()
    })
    .optional(),
  commitments: z
    .array(
      z.object({
        title: z.string().trim().min(2),
        commitmentType: z.nativeEnum(CommitmentType),
        dueDate: z.coerce.date(),
        amountRub: z.number().nonnegative(),
        notes: z.string().trim().max(500).optional()
      })
    )
    .default([]),
  replaceCommitments: z.boolean().default(false)
});

function getRiskLevel(minProjectedCashRub: number) {
  if (minProjectedCashRub < 0) {
    return RiskLevel.RISK;
  }

  if (minProjectedCashRub < 50000) {
    return RiskLevel.WATCH;
  }

  return RiskLevel.CLEAR;
}

function getRiskExplanation(level: RiskLevel, minProjectedCashRub: number, startingCashRub: number) {
  if (level === RiskLevel.RISK) {
    return `Прогнозный остаток уходит ниже нуля и достигает ${roundCurrency(minProjectedCashRub)} ₽. Нужны действия уже сейчас.`;
  }

  if (level === RiskLevel.WATCH) {
    return `Остаток остаётся положительным, но запас очень маленький: минимум ${roundCurrency(minProjectedCashRub)} ₽ при стартовом остатке ${roundCurrency(startingCashRub)} ₽.`;
  }

  return `Кассовая траектория выглядит устойчиво: минимальный остаток ${roundCurrency(minProjectedCashRub)} ₽.`;
}

export async function upsertCashInputs(input: z.infer<typeof cashInputsSchema>, options?: { organizationId?: string }) {
  const organization = await resolveOrganizationContext(options);
  const payload = cashInputsSchema.parse(input);

  await prisma.$transaction(async (tx) => {
    if (payload.snapshot) {
      await tx.cashSnapshot.upsert({
        where: {
          organizationId_snapshotDate: {
            organizationId: organization.id,
            snapshotDate: startOfUtcDay(payload.snapshot.snapshotDate)
          }
        },
        update: {
          availableRub: payload.snapshot.availableRub,
          notes: payload.snapshot.notes
        },
        create: {
          organizationId: organization.id,
          snapshotDate: startOfUtcDay(payload.snapshot.snapshotDate),
          availableRub: payload.snapshot.availableRub,
          notes: payload.snapshot.notes
        }
      });
    }

    if (payload.commitments.length > 0 && payload.replaceCommitments) {
      const dueDates = payload.commitments.map((item) => startOfUtcDay(item.dueDate));
      const minDate = dueDates.reduce((current, value) => (value < current ? value : current));
      const maxDate = dueDates.reduce((current, value) => (value > current ? value : current));

      await tx.cashCommitment.deleteMany({
        where: {
          organizationId: organization.id,
          dueDate: {
            gte: minDate,
            lte: maxDate
          }
        }
      });
    }

    if (payload.commitments.length > 0) {
      await tx.cashCommitment.createMany({
        data: payload.commitments.map((item) => ({
          organizationId: organization.id,
          title: item.title,
          commitmentType: item.commitmentType,
          dueDate: startOfUtcDay(item.dueDate),
          amountRub: item.amountRub,
          notes: item.notes
        }))
      });
    }
  });

  await recordAuditLog({
    organizationId: organization.id,
    entityType: "CashInputs",
    entityId: organization.id,
    action: "upserted",
    payload
  });

  await projectCashGap({
    organizationId: organization.id,
    asOfDate: new Date(),
    windowDays: 14
  });

  return { success: true };
}

export async function projectCashGap(input: { organizationId: string; asOfDate: Date; windowDays?: number }) {
  const assessmentDate = startOfUtcDay(input.asOfDate);
  const windowDays = input.windowDays ?? 14;
  const endDate = addUtcDays(assessmentDate, windowDays);
  const snapshot = await prisma.cashSnapshot.findFirst({
    where: {
      organizationId: input.organizationId,
      snapshotDate: {
        lte: assessmentDate
      }
    },
    orderBy: { snapshotDate: "desc" }
  });

  const startingCashRub = snapshot ? toNumber(snapshot.availableRub) : 0;
  const payouts = await prisma.payoutForecast.findMany({
    where: {
      organizationId: input.organizationId,
      forecastDate: {
        gte: assessmentDate,
        lte: endDate
      }
    }
  });
  const commitments = await prisma.cashCommitment.findMany({
    where: {
      organizationId: input.organizationId,
      dueDate: {
        gte: assessmentDate,
        lte: endDate
      }
    }
  });

  const payoutMap = new Map<string, number>();
  payouts.forEach((item) => {
    const key = startOfUtcDay(item.forecastDate).toISOString();
    payoutMap.set(key, (payoutMap.get(key) ?? 0) + toNumber(item.amountRub));
  });

  const commitmentMap = new Map<string, number>();
  commitments.forEach((item) => {
    const key = startOfUtcDay(item.dueDate).toISOString();
    commitmentMap.set(key, (commitmentMap.get(key) ?? 0) + toNumber(item.amountRub));
  });

  let projectedCashRub = startingCashRub;
  let minProjectedCashRub = projectedCashRub;
  const points = enumerateUtcDays(assessmentDate, endDate).map((date) => {
    const key = date.toISOString();
    const inflowRub = roundCurrency(payoutMap.get(key) ?? 0);
    const outflowRub = roundCurrency(commitmentMap.get(key) ?? 0);
    projectedCashRub = roundCurrency(projectedCashRub + inflowRub - outflowRub);
    minProjectedCashRub = Math.min(minProjectedCashRub, projectedCashRub);

    return {
      projectionDate: date,
      inflowRub,
      outflowRub,
      projectedCashRub
    };
  });

  const riskLevel = getRiskLevel(minProjectedCashRub);
  const explanation = getRiskExplanation(riskLevel, minProjectedCashRub, startingCashRub);

  const existing = await prisma.riskAssessment.findUnique({
    where: {
      organizationId_assessmentDate_windowDays: {
        organizationId: input.organizationId,
        assessmentDate,
        windowDays
      }
    }
  });

  const assessment = existing
    ? await prisma.$transaction(async (tx) => {
        await tx.cashProjectionPoint.deleteMany({
          where: { riskAssessmentId: existing.id }
        });

        const updated = await tx.riskAssessment.update({
          where: { id: existing.id },
          data: {
            riskLevel,
            startingCashRub,
            minProjectedCashRub,
            explanation
          }
        });

        await tx.cashProjectionPoint.createMany({
          data: points.map((point) => ({
            riskAssessmentId: updated.id,
            projectionDate: point.projectionDate,
            inflowRub: point.inflowRub,
            outflowRub: point.outflowRub,
            projectedCashRub: point.projectedCashRub
          }))
        });

        return updated;
      })
    : await prisma.$transaction(async (tx) => {
        const created = await tx.riskAssessment.create({
          data: {
            organizationId: input.organizationId,
            assessmentDate,
            windowDays,
            riskLevel,
            startingCashRub,
            minProjectedCashRub,
            explanation
          }
        });

        await tx.cashProjectionPoint.createMany({
          data: points.map((point) => ({
            riskAssessmentId: created.id,
            projectionDate: point.projectionDate,
            inflowRub: point.inflowRub,
            outflowRub: point.outflowRub,
            projectedCashRub: point.projectedCashRub
          }))
        });

        return created;
      });

  await recordAuditLog({
    organizationId: input.organizationId,
    entityType: "RiskAssessment",
    entityId: assessment.id,
    action: "projected",
    payload: {
      assessmentDate: assessmentDate.toISOString(),
      windowDays,
      riskLevel
    }
  });

  return {
    id: assessment.id,
    assessmentDate,
    windowDays,
    riskLevel,
    explanation,
    startingCashRub,
    minProjectedCashRub,
    points
  };
}

export async function getCashGapView(asOfDate?: Date, options?: { organizationId?: string }) {
  const organization = await resolveOrganizationContext(options);
  const assessmentDate = asOfDate ? startOfUtcDay(asOfDate) : undefined;
  const assessment = assessmentDate
    ? await prisma.riskAssessment.findUnique({
        where: {
          organizationId_assessmentDate_windowDays: {
            organizationId: organization.id,
            assessmentDate,
            windowDays: 14
          }
        },
        include: {
          projectionPoints: {
            orderBy: { projectionDate: "asc" }
          }
        }
      })
    : await prisma.riskAssessment.findFirst({
        where: { organizationId: organization.id, windowDays: 14 },
        include: {
          projectionPoints: {
            orderBy: { projectionDate: "asc" }
          }
        },
        orderBy: { assessmentDate: "desc" }
      });

  if (!assessment) {
    return null;
  }

  const points = assessment.projectionPoints.map((point) => ({
    projectionDate: point.projectionDate,
    inflowRub: toNumber(point.inflowRub),
    outflowRub: toNumber(point.outflowRub),
    projectedCashRub: toNumber(point.projectedCashRub)
  }));
  const minPoint = points.length > 0 ? points.reduce((current, point) => (point.projectedCashRub < current.projectedCashRub ? point : current), points[0]) : null;
  const gapPoint = points.find((point) => point.projectedCashRub < 0) ?? null;

  return {
    id: assessment.id,
    assessmentDate: assessment.assessmentDate,
    windowDays: assessment.windowDays,
    riskLevel: assessment.riskLevel,
    explanation: assessment.explanation,
    startingCashRub: toNumber(assessment.startingCashRub),
    minProjectedCashRub: toNumber(assessment.minProjectedCashRub),
    minProjectedDate: minPoint?.projectionDate ?? assessment.assessmentDate,
    firstGapDate: gapPoint?.projectionDate ?? null,
    points
  };
}

export async function getCashGapWorkspaceData(asOfDate?: Date, options?: { organizationId?: string }) {
  const organization = await resolveOrganizationContext(options);
  const [riskView, latestSnapshot, commitments] = await Promise.all([
    getCashGapView(asOfDate, options),
    prisma.cashSnapshot.findFirst({
      where: { organizationId: organization.id },
      orderBy: { snapshotDate: "desc" }
    }),
    prisma.cashCommitment.findMany({
      where: { organizationId: organization.id },
      orderBy: { dueDate: "asc" },
      take: 20
    })
  ]);

  return {
    riskView,
    latestSnapshot: latestSnapshot
      ? {
          snapshotDate: latestSnapshot.snapshotDate,
          availableRub: toNumber(latestSnapshot.availableRub),
          notes: latestSnapshot.notes
        }
      : null,
    commitments: commitments.map((item) => ({
      id: item.id,
      title: item.title,
      commitmentType: item.commitmentType,
      dueDate: item.dueDate,
      amountRub: toNumber(item.amountRub),
      notes: item.notes
    }))
  };
}
