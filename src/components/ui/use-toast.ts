"use client";

import * as React from "react";
import type { ToastProps } from "@radix-ui/react-toast";

type ToasterToast = {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "success" | "destructive";
} & Pick<ToastProps, "duration">;

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 4000;

type Action =
  | { type: "ADD"; toast: ToasterToast }
  | { type: "DISMISS"; toastId: string }
  | { type: "REMOVE"; toastId: string };

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

const listeners: Array<(state: ToasterToast[]) => void> = [];
let state: ToasterToast[] = [];

function dispatch(action: Action) {
  switch (action.type) {
    case "ADD":
      state = [action.toast, ...state].slice(0, TOAST_LIMIT);
      break;
    case "DISMISS":
    case "REMOVE":
      state = state.filter((t) => t.id !== action.toastId);
      break;
  }
  listeners.forEach((listener) => listener(state));
}

export function toast(props: Omit<ToasterToast, "id">) {
  const id = genId();
  dispatch({ type: "ADD", toast: { id, duration: TOAST_REMOVE_DELAY, ...props } });
  setTimeout(() => dispatch({ type: "REMOVE", toastId: id }), props.duration ?? TOAST_REMOVE_DELAY);
  return id;
}

export function useToast() {
  const [toasts, setToasts] = React.useState<ToasterToast[]>(state);

  React.useEffect(() => {
    listeners.push(setToasts);
    return () => {
      const index = listeners.indexOf(setToasts);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  return {
    toasts,
    toast,
    dismiss: (toastId: string) => dispatch({ type: "DISMISS", toastId }),
  };
}
