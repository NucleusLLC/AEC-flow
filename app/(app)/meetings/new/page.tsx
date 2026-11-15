import { redirect } from "next/navigation";

/**
 * New minutes are started from the project they belong to
 * (Projects › <project> › Meeting Minutes › New minutes). Old links land on the
 * project list to pick one.
 */
export default function NewMeetingRedirect() {
  redirect("/projects");
}
