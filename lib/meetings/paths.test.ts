import { describe, expect, it } from "vitest";
import { editMeetingHref, meetingHref, newMeetingHref, projectMeetingsHref } from "./paths";

describe("meeting minutes paths", () => {
  it("files every set of minutes under its project", () => {
    expect(projectMeetingsHref("p1")).toBe("/projects/p1/meetings");
    expect(newMeetingHref("p1")).toBe("/projects/p1/meetings/new");
    expect(meetingHref("p1", "m1")).toBe("/projects/p1/meetings/m1");
    expect(editMeetingHref("p1", "m1")).toBe("/projects/p1/meetings/m1/edit");
  });
});
