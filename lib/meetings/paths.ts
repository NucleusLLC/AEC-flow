/**
 * Where meeting minutes live.
 *
 * Minutes always belong to a project (MeetingMinute.projectId is required), so
 * they are filed under that project's own "Meeting Minutes" section rather than
 * in a list of their own. Every link to a set of minutes is built here, so the
 * shape of the URL is decided in one place.
 *
 * The old addresses (/meetings, /meetings/<id>, /meetings/<id>/edit) still
 * resolve: they redirect into the project, because they are in emails already
 * sent, in the activity log and in people's bookmarks.
 */

export function projectMeetingsHref(projectId: string): string {
  return `/projects/${projectId}/meetings`;
}

export function newMeetingHref(projectId: string): string {
  return `${projectMeetingsHref(projectId)}/new`;
}

export function meetingHref(projectId: string, meetingId: string): string {
  return `${projectMeetingsHref(projectId)}/${meetingId}`;
}

export function editMeetingHref(projectId: string, meetingId: string): string {
  return `${meetingHref(projectId, meetingId)}/edit`;
}
