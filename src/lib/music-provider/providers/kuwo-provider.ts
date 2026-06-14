import { BaseMusicProvider } from "../base-provider";
import type { MusicSource } from "@/types/music";

export class KuwoProvider extends BaseMusicProvider {
  source: MusicSource = "kuwo";
}
