"use client";

/**
 * A `<select>` that can also create the thing it selects.
 *
 * WHY THIS EXISTS. Half the write forms in this app ask the user to pick a
 * record they may not own yet: a schedule needs a project, a project needs a
 * client, a purchase order needs a supplier. When that list came back empty the
 * form had nothing to offer — sometimes an empty dropdown, sometimes prose
 * ("Create a project first, then come back here"), sometimes a validation error
 * the user could not act on ("Choose a client — a project must belong to one").
 * All three are the same defect: the form knows what is missing and makes the
 * user leave to go get it, losing whatever they had already typed.
 *
 * So the picker owns the creation. The last option is always "＋ Add new …";
 * choosing it opens a short form, and once the server action confirms with an
 * id the new record is selected and the user carries on in the same screen.
 *
 * WHY A DISCLOSURE PANEL AND NOT A MODAL. These pickers already live inside
 * other transient containers — `NewProjectPanel` sits in the Schedule module's
 * "New schedule" dropdown, the estimates picker in its own popover. A portalled
 * modal on top of that means two competing focus traps and a dropdown that
 * closes underneath its own child. Both of those containers are protected files
 * we may not restructure, so the create form expands in place instead: no
 * portal, no focus trap, nothing for the host to fight with.
 *
 * WHY IT NEVER TAKES A `required` FLAG. A creatable picker has no legitimate
 * empty state to validate against — if the record is missing the answer is to
 * create it here, not to refuse. Callers still decide whether an empty value
 * blocks submit, but they should be able to stop.
 */

import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { AlertTriangle, Plus } from "lucide-react";

/** Sentinel `<option>` value. Not a possible record id, so it cannot collide. */
const ADD_NEW = "__creatable_select_add_new__";

export type CreatableOption = {
  value: string;
  label: string;
};

/** One input in the inline create form. Keep these to what the action needs. */
export type CreatableField = {
  /** Key this value arrives under in `submit`'s draft argument. */
  name: string;
  label: string;
  placeholder?: string;
  type?: "text" | "email" | "tel";
  /** Blocks the create button until filled. Only the action's own required fields. */
  required?: boolean;
  /** Spans both columns in the two-up grid. */
  wide?: boolean;
};

export type CreatableResult =
  | { ok: true; option: CreatableOption }
  | { ok: false; error: string };

/**
 * The declarative create path: a handful of fields and the action that consumes
 * them. Used for everything whose minimum viable record is flat (client,
 * supplier, team member).
 */
export type CreatableSpec = {
  /** Heading of the create panel, e.g. "New client". */
  title: string;
  /** One line on what will be created, and what is being defaulted. */
  hint?: string;
  fields: CreatableField[];
  submitLabel?: string;
  /**
   * Runs the existing server action. Must resolve to the created record's real
   * id — the picker only selects it once the write is confirmed.
   */
  submit: (draft: Record<string, string>) => Promise<CreatableResult>;
};

const selectClass =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
const fieldClass =
  "mt-1 h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

export function CreatableSelect({
  label,
  value,
  onChange,
  options,
  create,
  renderCreate,
  addLabel,
  placeholder = "Select…",
  allowEmpty = false,
  hint,
  disabled,
  id,
  className,
  labelClassName = "block text-xs text-muted",
  onCreated,
  onCreateOpen,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Existing records. May be empty — that is the case this control is for. */
  options: CreatableOption[];
  /** Declarative create form. Ignored when `renderCreate` is given. */
  create?: CreatableSpec;
  /**
   * Escape hatch for a record whose own create form contains another picker
   * (a project needs a client), which no flat field list can express.
   */
  renderCreate?: (args: {
    onCreated: (option: CreatableOption) => void;
    onCancel: () => void;
  }) => ReactNode;
  /** e.g. "＋ Add a new client". Defaults from `create.title`. */
  addLabel?: string;
  placeholder?: string;
  /**
   * The field is genuinely optional (a material need not belong to a project),
   * so "no record" is a choice the user may re-select, not a placeholder to be
   * escaped. Also suppresses the prominent empty-list call to action — nothing
   * is blocked, so nothing needs pushing.
   */
  allowEmpty?: boolean;
  /** Shown under the select while closed. */
  hint?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  labelClassName?: string;
  /** Fires after a successful create, for callers that keep their own copy. */
  onCreated?: (option: CreatableOption) => void;
  /**
   * Fires when the create panel opens, including the auto-open on an empty list.
   * For a `renderCreate` form that needs to load something first: it must be
   * triggered from an effect, never from inside `renderCreate`, which runs
   * during render — on the server too, where starting a transition throws.
   */
  onCreateOpen?: () => void;
}) {
  const autoId = useId();
  const selectId = id ?? `creatable-${autoId}`;
  const panelId = `${selectId}-create`;

  // Records created in this session. Kept locally so the control works inside
  // hosts that cannot re-fetch their own options — including the protected
  // Schedule and Estimates panels, which receive their lists as props.
  const [created, setCreated] = useState<CreatableOption[]>([]);
  // With nothing on file the create form is the only useful thing on screen, so
  // it starts open rather than hiding one interaction deeper behind a dropdown.
  // Not when the field is optional (the user can simply move on), and not when a
  // value is already held — an edit form whose list came back short still has an
  // answer, and opening a create form over it would read as a demand.
  const [open, setOpen] = useState(options.length === 0 && !allowEmpty && !value);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const selectRef = useRef<HTMLSelectElement>(null);
  // Bumped on a successful create. The focus move has to happen in an effect
  // rather than inside `accept`: `accept` is handed to `renderCreate`, which runs
  // during render, and reading a ref from there is a lint error and a real
  // correctness hazard.
  const [focusTick, setFocusTick] = useState(0);

  useEffect(() => {
    // Return the caret to the picker once the create panel closes — the user's
    // next action is almost always the field after it, and without this focus is
    // lost with the panel.
    if (focusTick > 0) selectRef.current?.focus();
  }, [focusTick]);

  // Held in a ref so a caller passing an inline arrow does not re-fire this on
  // every render.
  const onCreateOpenRef = useRef(onCreateOpen);
  useEffect(() => {
    onCreateOpenRef.current = onCreateOpen;
  }, [onCreateOpen]);
  useEffect(() => {
    if (open) onCreateOpenRef.current?.();
  }, [open]);

  // An edit form can arrive holding a value the current list no longer contains
  // — a renamed client, a member since deactivated, or (before this change) one
  // of the hard-coded demo owner names. Keeping it as an option means the select
  // shows what is actually stored instead of rendering blank and then saving the
  // stale value anyway. `app/(app)/orders/[id]/edit` used to do this by hand.
  const orphan =
    value && !options.some((o) => o.value === value) && !created.some((o) => o.value === value)
      ? [{ value, label: value }]
      : [];
  // Drop locally-created records the host has meanwhile taken into `options` of
  // its own accord. Hosts legitimately do both — `NewProjectPanel` needs the new
  // client in its own list to resolve the name it submits — and without this the
  // record is listed twice.
  const mine = created.filter((c) => !options.some((o) => o.value === c.value));
  const all = [...orphan, ...options, ...mine];
  const addText = addLabel ?? `＋ Add a new ${(create?.title ?? "record").replace(/^new\s+/i, "")}`;

  function accept(option: CreatableOption) {
    setCreated((prev) => [...prev, option]);
    onChange(option.value);
    onCreated?.(option);
    setDraft({});
    setError(null);
    setOpen(false);
    setFocusTick((n) => n + 1);
  }

  function handleSelect(next: string) {
    if (next === ADD_NEW) {
      setError(null);
      setOpen(true);
      return;
    }
    onChange(next);
  }

  function submitDraft() {
    if (!create) return;
    const missing = create.fields.find((f) => f.required && !draft[f.name]?.trim());
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }
    setError(null);
    start(async () => {
      const trimmed: Record<string, string> = {};
      for (const [k, v] of Object.entries(draft)) trimmed[k] = v.trim();
      const res = await create.submit(trimmed);
      // Surface the action's own message verbatim — it carries the real reason
      // (a seat limit, a duplicate email) which no generic wording preserves.
      if (!res.ok) {
        setError(res.error);
        return;
      }
      accept(res.option);
    });
  }

  return (
    <div className={className}>
      <label className={labelClassName} htmlFor={selectId}>
        {label}
      </label>
      <select
        ref={selectRef}
        id={selectId}
        value={all.some((o) => o.value === value) ? value : ""}
        onChange={(e) => handleSelect(e.target.value)}
        disabled={disabled}
        aria-describedby={hint ? `${selectId}-hint` : undefined}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={selectClass}
      >
        <option value="" disabled={!allowEmpty}>
          {allowEmpty ? placeholder : all.length === 0 ? "Nothing on file yet" : placeholder}
        </option>
        {all.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {create || renderCreate ? <option value={ADD_NEW}>{addText}</option> : null}
      </select>
      {hint && !open ? (
        <p id={`${selectId}-hint`} className="mt-1 text-xs text-faint">
          {hint}
        </p>
      ) : null}

      {/* The empty list is the whole point of this control, so say so and put a
          real button next to it rather than leaving an inert dropdown. */}
      {all.length === 0 && !open && !allowEmpty ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/5 px-3 text-sm font-medium text-brand transition-colors hover:bg-brand/10"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {addText.replace(/^＋\s*/, "")}
        </button>
      ) : null}

      {open ? (
        <div id={panelId} className="mt-2 rounded-xl border border-border bg-surface-2 p-3">
          {renderCreate ? (
            renderCreate({ onCreated: accept, onCancel: () => setOpen(false) })
          ) : create ? (
            <>
              <p className="text-xs font-semibold text-fg">{create.title}</p>
              {create.hint ? <p className="mt-0.5 text-xs text-muted">{create.hint}</p> : null}

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {create.fields.map((f) => (
                  <label
                    key={f.name}
                    className={`block text-xs text-muted${f.wide ? " sm:col-span-2" : ""}`}
                  >
                    {f.label}
                    {f.required ? null : <span className="text-faint"> (optional)</span>}
                    <input
                      type={f.type ?? "text"}
                      value={draft[f.name] ?? ""}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, [f.name]: e.target.value }))
                      }
                      placeholder={f.placeholder}
                      // Enter submits the small form without submitting the host
                      // form it is nested inside.
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          submitDraft();
                        }
                      }}
                      className={fieldClass}
                    />
                  </label>
                ))}
              </div>

              {error ? (
                <p
                  role="alert"
                  className="mt-2 flex items-start gap-1.5 text-xs text-red-500"
                >
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  {error}
                </p>
              ) : null}

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={submitDraft}
                  disabled={pending}
                  className="inline-flex h-8 items-center rounded-lg bg-brand px-3 text-xs font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-50"
                >
                  {pending ? "Saving…" : (create.submitLabel ?? create.title)}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setError(null);
                  }}
                  disabled={pending}
                  className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
