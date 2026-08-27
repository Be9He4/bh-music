import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface AudioRouteLostEvent {
  reason: "audio-became-noisy";
}

export interface AudioRoutePlugin {
  addListener(
    eventName: "audioRouteLost",
    listenerFunc: (event: AudioRouteLostEvent) => void
  ): Promise<PluginListenerHandle>;
}

const AudioRoute = registerPlugin<AudioRoutePlugin>("AudioRoute");

export { AudioRoute };
