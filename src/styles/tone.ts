import type { Favorability } from '../domain/qimen/types';

export const TONE_CLASS: Record<Favorability, string> = {
  favorable: 'tone-good',
  mixed: 'tone-mixed',
  caution: 'tone-bad',
  neutral: 'tone-unknown',
  unknown: 'tone-unknown',
};

export const TONE_LABEL: Record<Favorability, string> = {
  favorable: '宜',
  mixed: '吉凶並見',
  caution: '宜慎',
  neutral: '平',
  unknown: '未知',
};
