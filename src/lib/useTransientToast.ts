"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useTransientToast() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastActive, setToastActive] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearToastTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const showToast = useCallback(
    (message: string) => {
      clearToastTimers();
      setToastMessage(message);
      setToastActive(false);

      const enterId = setTimeout(() => setToastActive(true), 10);
      const exitId = setTimeout(() => setToastActive(false), 1700);
      const hideId = setTimeout(() => setToastMessage(null), 2300);
      timersRef.current = [enterId, exitId, hideId];
    },
    [clearToastTimers]
  );

  useEffect(() => {
    return () => {
      clearToastTimers();
    };
  }, [clearToastTimers]);

  return { toastMessage, toastActive, showToast };
}
