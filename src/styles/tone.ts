import type { Favorability } from '../domain/qimen/types';

export const TONE_CLASS: Record<Favorability, string> = {
  favorable: 'tone-good',
  mixed: 'tone-mixed',
  caution: 'tone-bad',
  unknown: 'tone-unknown',
};

export const TONE_LABEL: Record<Favorability, string> = {
  favorable: '宜',
  mixed: '混合',
  caution: '忌',
  unknown: '未知',
};
