import type { Answer } from './types';
import type { ExamSession } from './learning-types';
import { parseExamSession, answerSchema } from './learning-validation';
import { z } from 'zod';

const cacheSchema = z
  .object({
    requestId: z.uuid(),
    guestToken: z.uuid().optional(),
    session: z.unknown().optional(),
    answers: z
      .record(z.string().max(180), answerSchema)
      .refine((value) => Object.keys(value).length <= 8),
    updatedAt: z.string().refine((value) => Number.isFinite(Date.parse(value))),
    position: z.number().int().min(0).max(8).optional(),
    dirty: z.boolean().optional(),
  })
  .strict();

export type LocalExam = {
  requestId: string;
  guestToken?: string;
  session?: ExamSession;
  answers: Record<string, Answer>;
  updatedAt: string;
  position?: number;
  dirty?: boolean;
};
export type GuestExamCapability = { id: string; token: string };
const key = (moduleId: string, owner?: string) => `finlab.exam.v2.${owner ?? 'guest'}.${moduleId}`;
const guestIndex = 'finlab.exam.v2.guest-capabilities';
export function readLocalExam(moduleId: string, owner?: string): LocalExam | null {
  try {
    const raw = localStorage.getItem(key(moduleId, owner));
    if (!raw || raw.length > 300000) return null;
    const parsed = cacheSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const session = parsed.data.session ? parseExamSession(parsed.data.session) : undefined;
    if (parsed.data.session && !session) return null;
    return { ...parsed.data, session: session ?? undefined };
  } catch {
    return null;
  }
}
export function writeLocalExam(moduleId: string, item: LocalExam, owner?: string): void {
  localStorage.setItem(key(moduleId, owner), JSON.stringify(item));
  if (!owner && item.session?.id && item.guestToken) {
    const entries = readGuestCapabilities();
    if (!entries.some((entry) => entry.id === item.session!.id)) {
      localStorage.setItem(
        guestIndex,
        JSON.stringify([...entries, { id: item.session.id, token: item.guestToken }]),
      );
    }
  }
}
export function readGuestCapabilities(): GuestExamCapability[] {
  try {
    const values: unknown = JSON.parse(localStorage.getItem(guestIndex) ?? '[]');
    if (!Array.isArray(values)) return [];
    const capabilities = z
      .array(z.object({ id: z.uuid(), token: z.uuid() }).strict())
      .safeParse(values);
    return capabilities.success
      ? [...new Map(capabilities.data.map((value) => [value.id, value])).values()].slice(0, 2000)
      : [];
  } catch {
    return [];
  }
}
export function forgetGuestCapability(id: string) {
  localStorage.setItem(
    guestIndex,
    JSON.stringify(readGuestCapabilities().filter((entry) => entry.id !== id)),
  );
}
