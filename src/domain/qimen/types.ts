/**
 * QiMenGFun domain types.
 * All pure data — no DOM, no React, no system clock.
 */

export type PalaceId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type ChartKind = 'hour' | 'ke';
export type TimeBasis = 'civil' | 'apparent-solar';
export type Dun = 'yang' | 'yin';
export type Yuan = 'upper' | 'middle' | 'lower';
export type Favorability = 'favorable' | 'mixed' | 'caution' | 'unknown';

export interface ChartInput {
  instantMs: number;
  timezone: string;
  basis: TimeBasis;
  longitude?: number;
  profileId: string;
}

export interface Palace {
  id: PalaceId;
  earthStems: string[];
  heavenStems: string[];
  stars: string[];
  door: string | null;
  deity: string | null;
  hostedFrom: PalaceId[];
  markers: string[];
}

export interface RuleTrace {
  ruleId: string;
  sourceId: string;
  inputs: Record<string, unknown>;
  outcome: string;
}

export interface Chart {
  kind: ChartKind;
  input: ChartInput;
  profileVersion: string;
  validFromMs: number;
  validUntilMs: number;
  dun: Dun;
  ju: number;
  yuan?: Yuan;
  term: string;
  fuTou: string;
  pillars: {
    year: string;
    month: string;
    day: string;
    hour: string;
  };
  xunHead: string;
  dutyStar: string;
  dutyDoor: string;
  palaces: Palace[];
  trace: RuleTrace[];
  /** Moon-like empty branches, mapped to direction names. */
  emptyBranches: string[];
  /** Stable canonical hash of the deterministic chart data. */
  hash: string;
}

export type ChartResult =
  | { status: 'ok'; chart: Chart }
  | { status: 'unverified' | 'unsupported' | 'invalid' | 'error'; reason: string };

export interface TermBoundary {
  name: string;
  instantMs: number;
}

/** Direction ring, clockwise from north. Palace 5 has no horizontal angle. */
export interface PalaceDef {
  id: PalaceId;
  deg: number | null;
  name: string;
  short: string;
  branches: string[];
  element: string;
}

export type DirectionDeg = 0 | 45 | 90 | 135 | 180 | 225 | 270 | 315;
