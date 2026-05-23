import { google } from 'googleapis';
import { getAuthorizedClient } from './google-auth.mjs';
import { gateContent } from './aya-gate.mjs';

export async function listActiveCourses() {
  const auth = await getAuthorizedClient();
  const classroom = google.classroom({ version: 'v1', auth });
  const res = await classroom.courses.list({
    courseStates: ['ACTIVE'],
    pageSize: 50,
  });
  return res.data.courses || [];
}

/**
 * Posts a course announcement. Content must pass AYA gate (always; Classroom is student-facing).
 * @param {{ courseId: string, text: string, dryRun?: boolean, policyPath?: string }} opts
 */
export async function postAnnouncement(opts) {
  const { courseId, text, dryRun, policyPath } = opts;
  const gate = gateContent(text, policyPath);
  if (!gate.ok) {
    throw new Error(`AYA gate blocked: ${gate.reasons.join('; ')}`);
  }

  if (dryRun) {
    console.log('[dry-run] Would post announcement to course', courseId);
    console.log('---');
    console.log(text);
    console.log('---');
    return { dryRun: true };
  }

  const auth = await getAuthorizedClient();
  const classroom = google.classroom({ version: 'v1', auth });
  const res = await classroom.courses.announcements.create({
    courseId,
    requestBody: {
      text,
      state: 'PUBLISHED',
    },
  });
  return res.data;
}
