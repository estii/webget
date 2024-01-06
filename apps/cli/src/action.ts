import { Browser, BrowserContext, Page } from "playwright";
import { Action } from "./api";

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type Point = { x: number; y: number };
export type Point3D = { x: number; y: number; z: number };
export type Size = { width: number; height: number };
export type Rect = Point & Size;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[P] extends ReadonlyArray<infer U>
    ? ReadonlyArray<DeepPartial<U>>
    : DeepPartial<T[P]>;
};

export type Asset = {
  input: string;
  path: string;
  extension: string;
  type: "webm" | "jpeg" | "png";
};

export type PlaywrightContext = {
  browser: Browser;
  context: BrowserContext;
  page: Page;
};

export type ActionState = {
  session: string | null;
};

export type ActionContext = PlaywrightContext & {
  output: Output;
  state: ActionState;
};

export type Output = Asset & {
  actions: Action[];
  width: number;
  height: number;
  baseURL: string | null;
  mouse: Point;
  scroll: Point;
  zoom: Point3D;
  background: string | null;
  foreground: string | null;
  border: string | null;
  caption: string | null;
  title: string | null;
  subtitle: string | null;
  start: number;
  trimLeft: number;
  trimRight: number;
  clip: Rect | null;
  template: null | { type: string; src: string };
};

export const defaultOutput: Omit<
  Output,
  "input" | "path" | "extension" | "type"
> = {
  actions: [],
  width: 1280,
  height: 720,
  baseURL: null,
  mouse: { x: 640, y: 10 },
  scroll: { x: 0, y: 0 },
  zoom: { x: 0, y: 0, z: 1 },
  background: null,
  foreground: null,
  border: null,
  caption: null,
  title: null,
  subtitle: null,
  start: 0,
  trimLeft: 0,
  trimRight: 0,
  clip: null,
  template: null,
};

export type Placement =
  | "auto"
  | "center"
  | "top"
  | "top-start"
  | "top-end"
  | "bottom"
  | "bottom-start"
  | "bottom-end"
  | "left"
  | "left-start"
  | "left-end"
  | "right"
  | "right-start"
  | "right-end";

export type ActionOptions = {
  /**
   * The position relative to the loc bounds
   * @default 'auto'
   */
  placement: Placement;
  /**
   * Shorthand for setting offset X and Y
   */
  offset: number | Partial<Point>;
  /**
   * Offset relative to the placement
   */
  offsetX: number;
  /**
   * Offset relative to the placement
   */
  offsetY: number;
  /**
   * Offset relative to the default scroll position.
   * Use this to fine tune how the loc is scrolled into view.
   */
  scrollOffset: number;
  /**
   * Prevent page scrolling. If not set, loc will always scroll into view if more than 400 pixels from top
   */
  noScroll: boolean;
  /**
   * Do not animate mouse (useful when scrolling vertically)
   */
  noMove: boolean;
  /**
   * Use the same offset for movement and click. By default click is uses the default location (middle of loc)
   */

  offsetClick: boolean;
  /**
   * Multiplier to adjust the default speed of the action. For movement, this increases the number of frames.
   * @default 1
   */
  speed: number;

  /**
   * Zoom scale for the browser window
   */
  zoom: boolean | number;
};

type ArgsType<T> = T extends (ctx: ActionContext, ...args: infer U) => any
  ? U
  : never;

export type ArgsUnion<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? Prettify<{ action: K } & { args: ArgsType<T[K]> }>
    : never;
}[keyof T];
