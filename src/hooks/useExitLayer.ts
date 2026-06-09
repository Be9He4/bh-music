"use client";

import { create } from "zustand";

interface ExitLayer {
  id: string;
  close: () => void;
}

interface ExitLayerStore {
  stack: ExitLayer[];
  push: (layer: Omit<ExitLayer, "id">) => string;
  pop: (id: string) => void;
  handleExit: () => boolean;
}

const generateId = () =>
  `exit-layer-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

export const useExitLayerStore = create<ExitLayerStore>((set, get) => ({
  stack: [],

  push: (layer) => {
    const id = generateId();
    set((state) => ({
      stack: [...state.stack, { ...layer, id }],
    }));
    return id;
  },

  pop: (id) => {
    set((state) => ({
      stack: state.stack.filter((layer) => layer.id !== id),
    }));
  },

  handleExit: () => {
    const { stack } = get();
    if (stack.length === 0) return false;

    const topLayer = stack[stack.length - 1];
    topLayer.close();
    set((state) => ({
      stack: state.stack.filter((layer) => layer.id !== topLayer.id),
    }));
    return true;
  },
}));

export function useExitLayer() {
  const push = useExitLayerStore((state) => state.push);
  const pop = useExitLayerStore((state) => state.pop);
  const handleExit = useExitLayerStore((state) => state.handleExit);
  const stack = useExitLayerStore((state) => state.stack);

  return {
    push,
    pop,
    handleExit,
    isEmpty: stack.length === 0,
  };
}
