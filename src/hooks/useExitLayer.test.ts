import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useExitLayerStore } from "./useExitLayer";

describe("useExitLayerStore", () => {
  beforeEach(() => {
    useExitLayerStore.setState({ stack: [] });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    useExitLayerStore.setState({ stack: [] });
  });

  it("returns false and does not invoke close when stack is empty", () => {
    const close = vi.fn();
    const result = useExitLayerStore.getState().handleExit();
    expect(result).toBe(false);
    expect(close).not.toHaveBeenCalled();
  });

  it("invokes the most recently pushed close on handleExit", () => {
    const closeA = vi.fn();
    const closeB = vi.fn();

    useExitLayerStore.getState().push({ close: closeA });
    useExitLayerStore.getState().push({ close: closeB });

    const result = useExitLayerStore.getState().handleExit();
    expect(result).toBe(true);
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();
  });

  it("closes frames in strict LIFO order across multiple handleExit calls", () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    const closeC = vi.fn();

    useExitLayerStore.getState().push({ close: closeA });
    useExitLayerStore.getState().push({ close: closeB });
    useExitLayerStore.getState().push({ close: closeC });

    useExitLayerStore.getState().handleExit();
    useExitLayerStore.getState().handleExit();
    useExitLayerStore.getState().handleExit();

    // LIFO：后入栈的先关闭，因此 C 调用顺序先于 B，B 先于 A
    expect(closeC.mock.invocationCallOrder[0]).toBeLessThan(
      closeB.mock.invocationCallOrder[0]
    );
    expect(closeB.mock.invocationCallOrder[0]).toBeLessThan(
      closeA.mock.invocationCallOrder[0]
    );
  });

  it("removes a frame after handleExit so it is not invoked twice", () => {
    const close = vi.fn();
    useExitLayerStore.getState().push({ close });

    useExitLayerStore.getState().handleExit();
    useExitLayerStore.getState().handleExit();

    expect(close).toHaveBeenCalledTimes(1);
    expect(useExitLayerStore.getState().stack).toEqual([]);
  });

  it("keeps a frame on the stack when close throws, and rethrows the error", () => {
    const boom = vi.fn(() => {
      throw new Error("close failed");
    });
    useExitLayerStore.getState().push({ close: boom });

    expect(() => useExitLayerStore.getState().handleExit()).toThrow(
      "close failed"
    );
    expect(boom).toHaveBeenCalledTimes(1);
    expect(useExitLayerStore.getState().stack).toHaveLength(1);

    // 再次 handleExit 仍尝试同一帧（验证未 pop）
    expect(() => useExitLayerStore.getState().handleExit()).toThrow(
      "close failed"
    );
    expect(boom).toHaveBeenCalledTimes(2);
  });

  it("pop is idempotent for unknown or already-removed ids", () => {
    const close = vi.fn();
    const id = useExitLayerStore.getState().push({ close });

    useExitLayerStore.getState().pop(id);
    useExitLayerStore.getState().pop(id);
    useExitLayerStore.getState().pop("non-existent-id");

    expect(useExitLayerStore.getState().stack).toEqual([]);
  });

  it("generates a unique id per push", () => {
    const a = useExitLayerStore.getState().push({ close: vi.fn() });
    const b = useExitLayerStore.getState().push({ close: vi.fn() });
    expect(a).not.toBe(b);
    expect(useExitLayerStore.getState().stack.map((l) => l.id)).toEqual([a, b]);
  });
});
