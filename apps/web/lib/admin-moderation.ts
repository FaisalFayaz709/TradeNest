import { jsonData } from './api-client';

type ModerationKind = 'users' | 'sellers' | 'products';
type ModerationAction = 'suspend' | 'reactivate';

/** A reason is required at the API boundary as well; this prompt is only UX. */
export async function moderateResource<T>(
  kind: ModerationKind, id: string, action: ModerationAction,
): Promise<T | null> {
  const reason = window.prompt(`Reason for ${action} of this ${kind.slice(0, -1)} (10-500 characters):`);
  if (reason === null) return null;
  const clean = reason.trim();
  if (clean.length < 10 || clean.length > 500) {
    throw new Error('Moderation reasons must contain 10–500 characters.');
  }
  if (!window.confirm(`Confirm ${action} of this ${kind.slice(0, -1)}? This action is audited.`)) return null;
  return jsonData<T>(`admin/${kind}/${encodeURIComponent(id)}/${action}`, 'POST', { reason: clean });
}
