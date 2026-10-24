"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { track } from "@vercel/analytics";

export function TrackLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} onClick={(event) => {
    track("portal_cta_click");
    onClick?.(event);
  }} />;
}
