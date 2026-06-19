import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MusicCover } from "./MusicCover";
import { useExitLayerStore } from "@/hooks/useExitLayer";

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

vi.mock("@capacitor/filesystem", () => ({
  Filesystem: { getUri: vi.fn() },
  Directory: { ExternalStorage: "EXTERNAL_STORAGE" },
}));

vi.mock("@capacitor/file-transfer", () => ({
  FileTransfer: { downloadFile: vi.fn() },
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/utils/download", () => ({
  ensurePermission: vi.fn(),
  triggerBlobDownload: vi.fn(),
}));

const SAMPLE_SRC = "https://example.com/cover.jpg";

describe("MusicCover preview exit stack integration", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    useExitLayerStore.setState({ stack: [] });
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container?.remove();
    root = undefined;
    container = undefined;
    document.body
      .querySelectorAll('[data-testid="cover-preview-portal"]')
      .forEach((el) => el.remove());
  });

  const render = (props: { previewable?: boolean; src?: string | null }) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(
        <MusicCover
          src={props.src ?? SAMPLE_SRC}
          alt="cover"
          previewable={props.previewable ?? true}
        />
      );
    });
    return {
      rerender: (nextProps: { previewable?: boolean; src?: string | null }) => {
        act(() => {
          root!.render(
            <MusicCover
              src={nextProps.src ?? SAMPLE_SRC}
              alt="cover"
              previewable={nextProps.previewable ?? true}
            />
          );
        });
      },
    };
  };

  const clickCover = () => {
    const img = container?.querySelector("img");
    if (!img) throw new Error("cover img not found");
    act(() => {
      img.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  };

  it("does not push to the stack when preview is closed", () => {
    render({});
    expect(useExitLayerStore.getState().stack).toHaveLength(0);
  });

  it("pushes to the stack when preview opens and pops when preview closes", () => {
    render({});

    clickCover();

    expect(useExitLayerStore.getState().stack).toHaveLength(1);
    expect(
      document.body.querySelector('[data-testid="cover-preview-portal"]')
    ).toBeTruthy();

    act(() => {
      useExitLayerStore.getState().handleExit();
    });

    expect(useExitLayerStore.getState().stack).toHaveLength(0);
    expect(
      document.body.querySelector('[data-testid="cover-preview-portal"]')
    ).toBeFalsy();
  });

  it("handleExit closes the preview and is idempotent on re-trigger", () => {
    render({});
    clickCover();

    act(() => {
      useExitLayerStore.getState().handleExit();
    });
    act(() => {
      useExitLayerStore.getState().handleExit();
    });

    expect(useExitLayerStore.getState().stack).toHaveLength(0);
  });

  it("clicking the overlay also closes the preview and pops the stack", () => {
    render({});
    clickCover();

    const overlay = document.body.querySelector(
      '[data-testid="cover-preview-portal"]'
    ) as HTMLElement | null;
    expect(overlay).toBeTruthy();

    act(() => {
      overlay!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(useExitLayerStore.getState().stack).toHaveLength(0);
  });

  it("reopening the preview re-pushes a fresh frame", () => {
    render({});

    clickCover();
    act(() => {
      useExitLayerStore.getState().handleExit();
    });
    expect(useExitLayerStore.getState().stack).toHaveLength(0);

    clickCover();
    expect(useExitLayerStore.getState().stack).toHaveLength(1);
  });

  it("unmounting the component pops its frame and does not leak", () => {
    render({});
    clickCover();
    expect(useExitLayerStore.getState().stack).toHaveLength(1);

    act(() => {
      root?.unmount();
      root = undefined;
    });

    expect(useExitLayerStore.getState().stack).toHaveLength(0);
  });

  it("resets error state when src changes so a new cover can load", () => {
    const { rerender } = render({ src: "invalid-url" });

    const firstImg = container?.querySelector("img");
    expect(firstImg).toBeTruthy();

    act(() => {
      firstImg!.dispatchEvent(new Event("error", { bubbles: true }));
    });

    // 加载失败后显示默认 Icon
    expect(container?.querySelector("img")).toBeFalsy();
    expect(container?.querySelector("svg")).toBeTruthy();

    rerender({ src: SAMPLE_SRC });

    // src 变化后应重新尝试加载图片
    const secondImg = container?.querySelector("img");
    expect(secondImg).toBeTruthy();
    expect(secondImg?.getAttribute("src")).toBe(SAMPLE_SRC);
  });
});
