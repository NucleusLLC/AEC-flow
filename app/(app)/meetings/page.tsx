import { redirect } from "next/navigation";

/**
 * Meeting Minutes are not a section of their own: each set is filed under its
 * project (Projects › <project> › Meeting Minutes). This address is kept only so
 * old bookmarks land somewhere useful — the project list.
 */
export default function MeetingsIndexRedirect() {
  redirect("/projects");
}
