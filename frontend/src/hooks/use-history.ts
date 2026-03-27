import { useState, useEffect } from "react";
import type { HistoryItem } from "@/types";

const HISTORY_KEY = "resumeai_v2_history";
const MAX_HISTORY = 30;

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  }, []);

  const saveHistory = (item: HistoryItem) => {
    setHistory((prev) => {
      const next = [item, ...prev].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch (e) {
        console.error("Failed to save history", e);
      }
      return next;
    });
  };

  const deleteHistory = (id: string) => {
    setHistory((prev) => {
      const next = prev.filter(h => h.id !== id);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch (e) {
        console.error("Failed to save history", e);
      }
      return next;
    });
  };
  
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  return { history, saveHistory, deleteHistory, clearHistory };
}
