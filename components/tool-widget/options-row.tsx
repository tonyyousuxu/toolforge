"use client";

import type { ToolOptionField } from "@/lib/tool-registry";

interface Props {
  fields: ToolOptionField[];
  values: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
  /** If true, Pro-only fields are disabled with tooltip. */
  userIsPro?: boolean;
}

/**
 * Module 2: Options Row — schema-driven renderer.
 * Driven purely by ToolDefinition.options[]. Each field type maps to a control.
 *
 * Expansion: add a new "type" to WidgetType union AND a case below.
 * ------------------------------------------------------------------------- */
export function OptionsRow({ fields, values, onChange, userIsPro = false }: Props) {
  if (fields.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-2 md:grid-cols-3">
      {fields.map((f) => {
        const locked = Boolean(f.proOnly && !userIsPro);
        return (
          <div key={f.id} className="flex flex-col gap-1.5">
            <label className="flex items-center justify-between text-xs font-medium text-foreground/80">
              <span>
                {f.label}
                {locked && (
                  <span className="ml-2 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    PRO
                  </span>
                )}
              </span>
            </label>
            <OptionControl
              field={f}
              value={values[f.id] ?? f.defaultValue}
              onChange={(v) => onChange(f.id, v)}
              disabled={locked}
            />
            {f.help && (
              <p className="text-[11px] leading-tight text-muted-foreground">{f.help}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OptionControl({
  field,
  value,
  onChange,
  disabled,
}: {
  field: ToolOptionField;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  const baseCls =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60";

  switch (field.type) {
    case "select":
      return (
        <select
          disabled={disabled}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={baseCls}
        >
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    case "toggle": {
      const on = Boolean(value);
      return (
        <div
          className="flex items-center gap-3"
          style={{ display: "flex", alignItems: "center", gap: "12px" }}
        >
          <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(!on)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: on ? "flex-end" : "flex-start",
              padding: "2px",
              width: "56px",
              height: "30px",
              borderRadius: "9999px",
              border: "1px solid rgba(0,0,0,0.12)",
              backgroundColor: on ? "#2563eb" : "#94a3b8",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.6 : 1,
              transition: "background-color 0.15s ease",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "9999px",
                backgroundColor: "#ffffff",
                boxShadow:
                  "0 1px 2px 0 rgba(0,0,0,0.15), 0 1px 1px 0 rgba(0,0,0,0.1)",
                transition: "transform 0.15s ease",
              }}
            />
          </button>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              color: on ? "#1d4ed8" : "#475569",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            {on ? "ON" : "OFF"}
          </span>
        </div>
      );
    }

    case "slider": {
      const min = field.min ?? 0;
      const max = field.max ?? 100;
      const step = field.step ?? 1;
      const num = Number(value);
      const clamped = Number.isFinite(num) ? Math.max(min, Math.min(max, num)) : min;
      return (
        <div className="flex items-center gap-3">
          <input
            type="range"
            disabled={disabled}
            min={min}
            max={max}
            step={step}
            value={clamped}
            onChange={(e) => onChange(Number(e.target.value))}
            className="h-2 flex-1 cursor-pointer accent-primary"
          />
          <input
            type="number"
            disabled={disabled}
            min={min}
            max={max}
            step={step}
            value={String(clamped)}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) {
                const c = Math.max(min, Math.min(max, v));
                onChange(c);
              }
            }}
            onBlur={(e) => {
              // Guarantee a valid value in the box on blur
              const v = Number(e.target.value);
              const c = Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : min;
              if (String(c) !== String(e.target.value)) onChange(c);
            }}
            style={{
              width: "64px",
              padding: "4px 6px",
              fontSize: "12px",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              textAlign: "center",
              borderRadius: "6px",
              border: "1px solid hsl(214.3, 31.8%, 91.4%)",
              backgroundColor: "hsl(210, 40%, 96.1%)",
              color: "hsl(222.2, 84%, 4.9%)",
              MozAppearance: "textfield",
            }}
          />
        </div>
      );
    }

    case "number":
      return (
        <input
          type="number"
          disabled={disabled}
          min={field.min}
          max={field.max}
          step={field.step}
          value={String(value ?? "")}
          onChange={(e) => onChange(Number(e.target.value))}
          className={baseCls}
        />
      );

    case "password":
      return (
        <input
          type="password"
          disabled={disabled}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter value…"
          className={baseCls}
        />
      );

    case "text":
    default:
      return (
        <input
          type="text"
          disabled={disabled}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter value…"
          className={baseCls}
        />
      );
  }
}
