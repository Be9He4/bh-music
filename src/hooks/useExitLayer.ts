"use client";

import { useEffect } from "react";
import { create } from "zustand";

interface ExitLayer {
  id: string;
  close: () => void;
  priority: number;
}

interface ExitLayerStore {
  layers: ExitLayer[];
  register: (layer: Omit<ExitLayer, "id">) => string;
  unregister: (id: string) => void;
  handleExit: () => boolean;
}

export const useExitLayerStore = create<ExitLayerStore>((set, get) => ({
  layers: [],

  register: (layer) => {
    const id = `exit-layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    set((state) => ({
      layers: [...state.layers, { ...layer, id }].sort((a, b) => b.priority - a.priority),
    }));
    return id;
  },

  unregister: (id) => {
    set((state) => ({
      layers: state.layers.filter((layer) => layer.id !== id),
    }));
  },

  handleExit: () => {
    const { layers } = get();
    if (layers.length === 0) return false;

    const topLayer = layers[0];
    topLayer.close();
    return true;
  },
}));

export function useExitLayer() {
  const register = useExitLayerStore((state) => state.register);
  const unregister = useExitLayerStore((state) => state.unregister);
  const handleExit = useExitLayerStore((state) => state.handleExit);
  const layers = useExitLayerStore((state) => state.layers);

  return {
    register,
    unregister,
    handleExit,
    hasLayers: layers.length > 0,
  };
}

export function useRegisterExitLayer(close: () => void, isOpen: boolean, priority = 10) {
  const { register, unregister } = useExitLayer();

  useEffect(() => {
    let id: string | undefined;
    if (isOpen) {
      id = register({ close, priority });
    }
    return () => {
      if (id) {
        unregister(id);
      }
    };
  }, [isOpen, close, register, unregister]);
}
