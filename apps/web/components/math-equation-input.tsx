"use client";

import {createElement, useEffect, useRef, useState} from "react";

import {normalizeEquationInput} from "../lib/equation-input";

type MathLiveGlobal = typeof globalThis & {
  MathfieldElement?: {
    fontsDirectory: string | null;
  };
};

type MathFieldElement = HTMLElement & {
  menuItems?: unknown[];
  mathVirtualKeyboardPolicy?: "auto" | "manual" | "sandboxed";
  value?: string;
  placeholder?: string;
  getValue?: (format?: string) => string;
};

interface MathEquationInputProps {
  value: string;
  disabled: boolean;
  onEquationChange: (visibleValue: string, submitValue: string) => void;
}

export function MathEquationInput({value, disabled, onEquationChange}: MathEquationInputProps) {
  const mathfieldRef = useRef<MathFieldElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const submitValue = normalizeEquationInput(value);
  const showPlaceholder = value.trim().length === 0;

  useEffect(() => {
    let cancelled = false;
    void import("mathlive").then(() => {
      const mathLiveGlobal = globalThis as MathLiveGlobal;
      if (mathLiveGlobal.MathfieldElement) {
        mathLiveGlobal.MathfieldElement.fontsDirectory = null;
      }
      if (!cancelled) {
        setIsReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const mathfield = mathfieldRef.current;
    if (!mathfield) {
      return;
    }
    mathfield.mathVirtualKeyboardPolicy = "manual";
    mathfield.menuItems = [];
    mathfield.placeholder = "";
    if (mathfield.value !== value) {
      mathfield.value = value;
    }
  }, [isReady, value]);

  useEffect(() => {
    const mathfield = mathfieldRef.current;
    if (!mathfield) {
      return;
    }

    const currentMathfield = mathfield;

    function handleInput() {
      const sourceValue =
        currentMathfield.getValue?.("latex") ??
        currentMathfield.getValue?.() ??
        currentMathfield.value ??
        "";
      onEquationChange(sourceValue, normalizeEquationInput(sourceValue));
    }

    currentMathfield.addEventListener("input", handleInput);
    return () => currentMathfield.removeEventListener("input", handleInput);
  }, [isReady, onEquationChange]);

  return (
    <>
      {isReady ? (
        <div className="relative min-w-0 flex-1">
          {showPlaceholder ? (
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center font-mono text-lg text-zinc-500 sm:left-5 sm:text-xl">
              Enter a quadratic equation
            </span>
          ) : null}
          {createElement("math-field", {
            ref: mathfieldRef,
            "aria-label": "Equation",
            className:
              "math-equation-input w-full bg-transparent px-4 py-4 font-mono text-lg text-zinc-100 outline-none sm:px-5 sm:text-xl",
            "data-testid": "equation-mathfield",
            id: "equation",
            "math-virtual-keyboard-policy": "manual",
            placeholder: "",
            "read-only": disabled ? "" : undefined,
            tabIndex: disabled ? -1 : 0
          })}
        </div>
      ) : (
        <div
          aria-label="Equation"
          className="min-w-0 flex-1 px-4 py-4 font-mono text-lg text-zinc-500 sm:px-5 sm:text-xl"
          role="textbox"
        >
          Enter a quadratic equation
        </div>
      )}
      <input aria-hidden="true" name="equation" readOnly tabIndex={-1} type="hidden" value={submitValue} />
    </>
  );
}
